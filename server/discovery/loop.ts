/**
 * Discovery Loop Orchestrator — TypeScript port of loop_scheduler.py + hiv_loop_extension.py
 *
 * Implements the 7-step HIV protease discovery micro-loop:
 *   Step 1: Load corpus from database (or seed from corpus-data.ts)
 *   Step 2: Generate candidates across 4 tracks (50 per track = 200 total)
 *   Step 3: ML ensemble scoring (10 models, pIC50 prediction)
 *   Step 4: Quantum scoring (WuKong + Quafu + Jiuzhang simulation)
 *   Step 5: Citation gate (8-stage verification pipeline)
 *   Step 6: Convergence detection (from day 7 onwards)
 *   Step 7: Update cognition store + daily log + notify owner
 *
 * The loop is triggered by the Manus Heartbeat scheduler (every 4 hours).
 * Each trigger = one micro-cycle. 6 cycles/day × 30 days = 180 cycles total.
 */

import { getDb } from "../db";
import {
  candidates as candidatesTable,
  citationRegistry,
  cognitionStore,
  corpus as corpusTable,
  cycles as cyclesTable,
  dailyLogs,
} from "../../drizzle/schema";
import { eq, desc, count } from "drizzle-orm";
import { HIV_PROTEASE_CORPUS } from "./corpus-data";
import { generateAllTracks, filterDruglike, type GeneratedCandidate } from "./engineer";
import { predictBatch, trainEnsemble, quantumScore, type PredictionResult } from "./predictor";
import { batchCitationGate } from "./citation-gate";
import {
  detectConvergence,
  shouldRunConvergence,
  formatConvergenceReport,
  type TrackResult,
} from "./convergence";
import { notifyOwner } from "../_core/notification";

type QuantumResult = Awaited<ReturnType<typeof quantumScore>>;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LoopStatus {
  isRunning: boolean;
  lastCycleAt: Date | null;
  lastCycleNumber: number;
  dayNumber: number;
  totalCandidates: number;
  bestPic50: number;
  bestSmiles: string | null;
  convergenceCandidates: number;
  corpusSize: number;
  error: string | null;
}

export interface CycleResult {
  cycleNumber: number;
  dayNumber: number;
  candidatesGenerated: number;
  candidatesVerified: number;
  bestPic50: number;
  convergenceCandidates: number;
  citationPassRate: string;
  durationMs: number;
  error?: string;
}

interface ScoredCandidate extends GeneratedCandidate {
  pic50Predicted: number;
  confidenceScore: number;
  ensembleStd: number;
  pic50Vqe: number | null;
  quantumHardware: string;
  quantumScore: number;
  provenanceStatus: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory state (persisted to DB after each cycle)
// ─────────────────────────────────────────────────────────────────────────────

let loopRunning = false;
const loopStatus: LoopStatus = {
  isRunning: false,
  lastCycleAt: null,
  lastCycleNumber: 0,
  dayNumber: 1,
  totalCandidates: 0,
  bestPic50: 0,
  bestSmiles: null,
  convergenceCandidates: 0,
  corpusSize: 0,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Corpus management
// ─────────────────────────────────────────────────────────────────────────────

async function ensureCorpusSeeded(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const existing = await db.select({ count: count() }).from(corpusTable);
  const existingCount = existing[0]?.count ?? 0;

  if (existingCount >= HIV_PROTEASE_CORPUS.length) {
    return existingCount;
  }

  for (const record of HIV_PROTEASE_CORPUS) {
    try {
      await db
        .insert(corpusTable)
        .ignore()
        .values({
          refId: record.id,
          name: record.name,
          smiles: record.smiles,
          source: record.source,
          pIC50: record.pIC50,
          confidence: record.confidence,
          scaffold: record.scaffold,
        });
    } catch {
      // Ignore duplicate key errors
    }
  }

  const updated = await db.select({ count: count() }).from(corpusTable);
  const newCount = updated[0]?.count ?? 0;
  console.log(`[Loop] Corpus seeded: ${newCount} records`);
  return newCount;
}

async function getKnownSmiles(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();

  const rows = await db.select({ smiles: candidatesTable.smiles }).from(candidatesTable);
  const corpusRows = await db.select({ smiles: corpusTable.smiles }).from(corpusTable);
  const known = new Set<string>();
  rows.forEach((r: { smiles: string }) => known.add(r.smiles));
  corpusRows.forEach((r: { smiles: string }) => known.add(r.smiles));
  return known;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 7: Cognition store update
// ─────────────────────────────────────────────────────────────────────────────

async function updateCognitionStore(
  cycleNumber: number,
  dayNumber: number,
  bestPic50: number,
  bestSmiles: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select()
    .from(cognitionStore)
    .where(eq(cognitionStore.targetChemblId, "CHEMBL247"))
    .limit(1);

  const lesson = `Cycle ${cycleNumber} (Day ${dayNumber}): Best pIC50=${bestPic50.toFixed(2)}${bestSmiles ? `, SMILES=${bestSmiles.substring(0, 40)}` : ""}`;

  if (existing.length === 0) {
    await db.insert(cognitionStore).values({
      targetChemblId: "CHEMBL247",
      targetName: "HIV-1 Protease",
      bestAffinityEver: bestPic50 > 0 ? Math.pow(10, 9 - bestPic50) : null,
      bestSmilsEver: bestSmiles,
      bestPic50Ever: bestPic50 > 0 ? bestPic50 : null,
      cycleCount: cycleNumber,
      dayNumber,
      accumulatedLessons: [lesson],
      statisticalPatterns: {},
    });
  } else {
    const current = existing[0];
    const lessons = (current.accumulatedLessons as string[]) || [];
    lessons.push(lesson);
    const trimmedLessons = lessons.slice(-100);

    const isNewBest = bestPic50 > (current.bestPic50Ever ?? 0);

    await db
      .update(cognitionStore)
      .set({
        cycleCount: cycleNumber,
        dayNumber,
        bestPic50Ever: isNewBest ? bestPic50 : current.bestPic50Ever,
        bestSmilsEver: isNewBest ? bestSmiles : current.bestSmilsEver,
        bestAffinityEver: isNewBest
          ? Math.pow(10, 9 - bestPic50)
          : current.bestAffinityEver,
        accumulatedLessons: trimmedLessons,
      })
      .where(eq(cognitionStore.targetChemblId, "CHEMBL247"));

    // Notify owner when a new global best pIC50 is achieved
    if (isNewBest && bestPic50 > 0) {
      const prevBest = current.bestPic50Ever ?? 0;
      const improvement = bestPic50 - prevBest;
      notifyOwner({
        title: `notus.is — New Best pIC50: ${bestPic50.toFixed(2)}`,
        content:
          `New global best HIV protease inhibitor candidate found!\n` +
          `pIC50: ${bestPic50.toFixed(2)} (prev: ${prevBest.toFixed(2)}, +${improvement.toFixed(2)})\n` +
          `Day: ${dayNumber}, Cycle: ${cycleNumber}\n` +
          (bestSmiles ? `SMILES: ${bestSmiles.substring(0, 80)}` : ""),
      }).catch(() => {/* best-effort */});
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main cycle function
// ─────────────────────────────────────────────────────────────────────────────

export async function runSingleCycle(): Promise<CycleResult> {
  if (loopRunning) {
    console.log("[Loop] Cycle already running, skipping");
    return {
      cycleNumber: loopStatus.lastCycleNumber,
      dayNumber: loopStatus.dayNumber,
      candidatesGenerated: 0,
      candidatesVerified: 0,
      bestPic50: loopStatus.bestPic50,
      convergenceCandidates: loopStatus.convergenceCandidates,
      citationPassRate: "0/0",
      durationMs: 0,
      error: "Cycle already running",
    };
  }

  loopRunning = true;
  loopStatus.isRunning = true;
  loopStatus.error = null;
  const startTime = Date.now();

  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // ── Step 1: Ensure corpus is seeded ───────────────────────────────────────
    const corpusSize = await ensureCorpusSeeded();
    loopStatus.corpusSize = corpusSize;

    const lastCycle = await db
      .select({ cycleNumber: cyclesTable.cycleNumber })
      .from(cyclesTable)
      .orderBy(desc(cyclesTable.cycleNumber))
      .limit(1);

    const cycleNumber = (lastCycle[0]?.cycleNumber ?? 0) + 1;
    const dayNumber = Math.ceil(cycleNumber / 6);
    loopStatus.lastCycleNumber = cycleNumber;
    loopStatus.dayNumber = dayNumber;

    console.log(`[Loop] Starting cycle ${cycleNumber} (Day ${dayNumber})`);

    // ── Step 2: Generate candidates across 4 tracks ───────────────────────────
    const knownSmiles = await getKnownSmiles();
    const generated = await generateAllTracks(cycleNumber, knownSmiles);
    const druglike = filterDruglike(generated);

    console.log(`[Loop] Generated ${generated.length} candidates, ${druglike.length} drug-like`);

    // ── Step 3: ML ensemble scoring ───────────────────────────────────────────
    await trainEnsemble();
    const predictions: (PredictionResult | null)[] = await predictBatch(druglike.map((c: GeneratedCandidate) => c.smiles));

    // ── Step 4: Quantum scoring ───────────────────────────────────────────────
    const wukongKey = process.env.WUKONG_API_KEY;
    const quafuKey = process.env.QUAFU_API_KEY;

    const scoredCandidates: (ScoredCandidate | null)[] = await Promise.all(
      druglike.map(async (candidate: GeneratedCandidate, i: number) => {
        const pred = predictions[i];
        if (!pred) return null;

        const qScore: QuantumResult = await quantumScore(
          candidate.smiles,
          pred.pic50,
          wukongKey,
          quafuKey
        );

        return {
          ...candidate,
          pic50Predicted: pred.pic50,
          confidenceScore: pred.confidence,
          ensembleStd: pred.ensembleStd,
          pic50Vqe: qScore.pic50Vqe,
          quantumHardware: qScore.hardware,
          quantumScore: qScore.quantumScore,
          provenanceStatus: qScore.provenance,
        } as ScoredCandidate;
      })
    );

    const validScored = scoredCandidates.filter((c): c is ScoredCandidate => c !== null);

    // ── Step 5: Citation gate ─────────────────────────────────────────────────
    const topCandidates = validScored
      .filter((c: ScoredCandidate) => c.pic50Predicted >= 7.5)
      .sort((a: ScoredCandidate, b: ScoredCandidate) => b.pic50Predicted - a.pic50Predicted)
      .slice(0, 20);

    const citationResults = await batchCitationGate(
      topCandidates.map((c: ScoredCandidate) => ({
        smiles: c.smiles,
        pic50: c.pic50Predicted,
        isDruglike: c.admet?.isDruglike ?? false,
      }))
    );

    const citationPassSet = new Set(citationResults.map((r: { smiles: string }) => r.smiles));
    const citationPassRate = `${citationResults.length}/${topCandidates.length}`;

    // ── Insert cycle record ───────────────────────────────────────────────────
    const bestPic50 = validScored.length > 0
      ? Math.max(...validScored.map((c: ScoredCandidate) => c.pic50Predicted))
      : 0;
    const bestCandidate = validScored.find((c: ScoredCandidate) => c.pic50Predicted === bestPic50);

    const cycleInsert = await db.insert(cyclesTable).values({
      cycleNumber,
      dayNumber,
      corpusSize,
      candidatesGenerated: generated.length,
      candidatesVerified: citationResults.length,
      bestPic50,
      convergenceCandidates: 0,
      citationPassRate,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cycleId = Number((cycleInsert as any).insertId);

    // ── Insert candidate records ──────────────────────────────────────────────
    for (const candidate of validScored) {
      const citationResult = citationResults.find(
        (r: { smiles: string }) => r.smiles === candidate.smiles
      );
      const isBestSoFar = candidate.smiles === bestCandidate?.smiles;

      await db.insert(candidatesTable).values({
        cycleId,
        smiles: candidate.smiles,
        parentSmiles: candidate.parentSmiles,
        track: candidate.track,
        modificationType: candidate.modificationType,
        pic50Predicted: candidate.pic50Predicted,
        confidenceScore: candidate.confidenceScore,
        pic50Vqe: candidate.pic50Vqe,
        quantumHardware: candidate.quantumHardware,
        quantumScore: candidate.quantumScore,
        provenanceStatus: candidate.provenanceStatus,
        citationVerdict: citationResult?.citationResult.verdict,
        citationConfidence: citationResult?.citationResult.confidence,
        citationGatePassed: citationPassSet.has(candidate.smiles),
        pubmedIds: citationResult?.citationResult.pubmedIds ?? [],
        citationIds: citationResult?.citationResult.citationIds ?? [],
        mw: candidate.admet?.mw,
        logp: candidate.admet?.logp,
        hbd: candidate.admet?.hbd,
        hba: candidate.admet?.hba,
        tpsa: candidate.admet?.tpsa,
        lipinskiViolations: candidate.admet?.lipinskiViolations,
        isDruglike: candidate.admet?.isDruglike ?? false,
        isNovel: candidate.isNovel,
        tanimotoToApproved: candidate.tanimotoToParent,
        isBestSoFar,
      });

      if (citationResult?.citationResult.citationUrl) {
        const candidateRow = await db
          .select({ id: candidatesTable.id })
          .from(candidatesTable)
          .where(eq(candidatesTable.smiles, candidate.smiles))
          .limit(1);

        if (candidateRow[0]) {
          await db.insert(citationRegistry).values({
            candidateId: candidateRow[0].id,
            citationUrl: citationResult.citationResult.citationUrl,
            claimText: citationResult.citationResult.verdict,
          });
        }
      }
    }

    // ── Step 6: Convergence detection ─────────────────────────────────────────
    let convergenceCandidates = 0;
    let convergenceReport = null;

    if (shouldRunConvergence(dayNumber)) {
      const trackResults: TrackResult[] = validScored.map((c: ScoredCandidate) => ({
        track: c.track as "A" | "B" | "C" | "D",
        smiles: c.smiles,
        pic50: c.pic50Predicted,
        ensembleStd: c.ensembleStd,
        confidence: c.confidenceScore,
      }));

      const report = await detectConvergence(trackResults, cycleNumber, dayNumber);
      convergenceCandidates = report.convergenceCandidates.length;
      convergenceReport = report;

      await db
        .update(cyclesTable)
        .set({
          convergenceCandidates,
          convergenceReport: report,
        })
        .where(eq(cyclesTable.id, cycleId));

      if (convergenceCandidates > 0) {
        console.log(formatConvergenceReport(report));
      }
    }

    // ── Step 7: Update cognition store + daily log ────────────────────────────
    await updateCognitionStore(cycleNumber, dayNumber, bestPic50, bestCandidate?.smiles ?? null);

    const existingLog = await db
      .select()
      .from(dailyLogs)
      .where(eq(dailyLogs.dayNumber, dayNumber))
      .limit(1);

    const totalForDay = await db
      .select({ count: count() })
      .from(candidatesTable)
      .innerJoin(cyclesTable, eq(candidatesTable.cycleId, cyclesTable.id))
      .where(eq(cyclesTable.dayNumber, dayNumber));

    const summary =
      `Day ${dayNumber}, Cycle ${cycleNumber}: ` +
      `${generated.length} candidates generated, ` +
      `${citationResults.length} verified, ` +
      `best pIC50=${bestPic50.toFixed(2)}` +
      (convergenceCandidates > 0 ? `, ${convergenceCandidates} convergence candidates` : "");

    if (existingLog.length === 0) {
      await db.insert(dailyLogs).values({
        dayNumber,
        cycleCount: 1,
        summary,
        runData: { cycleNumber, bestPic50, citationPassRate, totalForDay: totalForDay[0]?.count ?? 0 },
        convergenceReport,
      });
    } else {
      await db
        .update(dailyLogs)
        .set({
          cycleCount: existingLog[0].cycleCount + 1,
          summary,
          runData: { cycleNumber, bestPic50, citationPassRate },
          convergenceReport: convergenceReport ?? existingLog[0].convergenceReport,
        })
        .where(eq(dailyLogs.dayNumber, dayNumber));
    }

    loopStatus.lastCycleAt = new Date();
    loopStatus.totalCandidates += validScored.length;
    loopStatus.bestPic50 = Math.max(loopStatus.bestPic50, bestPic50);
    loopStatus.bestSmiles = bestCandidate?.smiles ?? loopStatus.bestSmiles;
    loopStatus.convergenceCandidates = convergenceCandidates;

    const durationMs = Date.now() - startTime;
    const result: CycleResult = {
      cycleNumber,
      dayNumber,
      candidatesGenerated: generated.length,
      candidatesVerified: citationResults.length,
      bestPic50,
      convergenceCandidates,
      citationPassRate,
      durationMs,
    };

    if (cycleNumber % 6 === 0) {
      await notifyOwner({
        title: `notus.is — Day ${dayNumber} Complete`,
        content:
          `Discovery loop completed Day ${dayNumber}.\n` +
          `Best pIC50: ${bestPic50.toFixed(2)}\n` +
          `Total candidates: ${loopStatus.totalCandidates}\n` +
          `Convergence candidates: ${convergenceCandidates}\n` +
          `Duration: ${(durationMs / 1000).toFixed(1)}s`,
      });
    }

    console.log(
      `[Loop] Cycle ${cycleNumber} complete in ${durationMs}ms. ` +
      `Best pIC50=${bestPic50.toFixed(2)}, verified=${citationResults.length}`
    );

    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    loopStatus.error = error;
    console.error("[Loop] Cycle failed:", error);
    return {
      cycleNumber: loopStatus.lastCycleNumber,
      dayNumber: loopStatus.dayNumber,
      candidatesGenerated: 0,
      candidatesVerified: 0,
      bestPic50: 0,
      convergenceCandidates: 0,
      citationPassRate: "0/0",
      durationMs: Date.now() - startTime,
      error,
    };
  } finally {
    loopRunning = false;
    loopStatus.isRunning = false;
  }
}

export function getLoopStatus(): LoopStatus {
  return { ...loopStatus };
}

export async function getLoopStats(): Promise<{
  totalCycles: number;
  totalCandidates: number;
  bestPic50: number;
  bestSmiles: string | null;
  dayNumber: number;
  corpusSize: number;
  convergenceCandidates: number;
  lastCycleAt: Date | null;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalCycles: 0, totalCandidates: 0, bestPic50: 0,
      bestSmiles: null, dayNumber: 1, corpusSize: 0,
      convergenceCandidates: 0, lastCycleAt: null,
    };
  }

  const [cycleStats, candidateStats, corpusStat, cognitionStat, lastCycle] =
    await Promise.all([
      db.select({ count: count() }).from(cyclesTable),
      db.select({ count: count() }).from(candidatesTable),
      db.select({ count: count() }).from(corpusTable),
      db.select().from(cognitionStore).where(eq(cognitionStore.targetChemblId, "CHEMBL247")).limit(1),
      db.select().from(cyclesTable).orderBy(desc(cyclesTable.createdAt)).limit(1),
    ]);

  return {
    totalCycles: cycleStats[0]?.count ?? 0,
    totalCandidates: candidateStats[0]?.count ?? 0,
    bestPic50: cognitionStat[0]?.bestPic50Ever ?? 0,
    bestSmiles: cognitionStat[0]?.bestSmilsEver ?? null,
    dayNumber: cognitionStat[0]?.dayNumber ?? 1,
    corpusSize: corpusStat[0]?.count ?? 0,
    convergenceCandidates: lastCycle[0]?.convergenceCandidates ?? 0,
    lastCycleAt: lastCycle[0]?.createdAt ?? null,
  };
}
