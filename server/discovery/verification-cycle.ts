/**
 * Unified Verification Cycle — Phase-C
 *
 * Implements the 6-phase discovery-to-convergence loop as a single,
 * traceable unit of work. Each call to runVerificationCycle() runs:
 *
 *   Phase 1 DISCOVER    — Query 65 sources via Python bridge
 *   Phase 2 SCORE       — ML ensemble + quantum VQE on generated candidates
 *   Phase 3 VERIFY      — Submit top-10 claims to citation.manus.space
 *   Phase 4 COGNITION   — Feed citation verdicts into evolve_cognition
 *   Phase 5 EVOLVE      — Call runEvolveStep(), capture ASI-Evolve output
 *   Phase 6 CONVERGENCE — Check termination criteria, update loop_state
 *
 * Results are persisted to the `verification_cycles` table and the
 * in-memory status is updated for tRPC polling.
 */

import { randomUUID } from "crypto";
import { getDb } from "../db";
import {
  verificationCycles as verificationCyclesTable,
  type PhaseResult,
  type VerificationCyclePhases,
  type VerificationCycleRow,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// Discovery engine imports
import { pythonBridge } from "./python-bridge";
import { generateAllTracks, filterDruglike } from "./engineer";
import { predictBatch, trainEnsemble, quantumScore } from "./predictor";
import {
  detectConvergence,
  shouldRunConvergence,
  type TrackResult,
} from "./convergence";

// ASI-Evolve imports
import { runEvolveStep } from "./asi-evolve/orchestrator";
import { addCognitionItem } from "./asi-evolve/cognition";
import { getOrCreateRun } from "./asi-evolve/database";
import {
  verifyClaim,
  buildCandidateClaim,
  verdictScoreModifier,
} from "./asi-evolve/citation-client";

// ─────────────────────────────────────────────────────────────────────────────
// Public types (re-exported from schema for convenience)
// ─────────────────────────────────────────────────────────────────────────────

export type { PhaseResult, VerificationCyclePhases };

/**
 * The canonical VerificationCycle interface as specified in Phase-C.
 * Mirrors the DB row but uses Date objects for timestamps.
 */
export interface VerificationCycle {
  cycleId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: "running" | "completed" | "failed";
  phases: VerificationCyclePhases;
  // Denormalised summary stats
  candidatesDiscovered: number;
  candidatesScored: number;
  claimsVerified: number;
  cognitionItemsAdded: number;
  evolveStepName: string | null;
  evolveScore: number | null;
  convergenceReached: boolean;
  bestPic50: number | null;
  errorMessage: string | null;
  durationMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePhase(status: PhaseResult["status"] = "pending"): PhaseResult {
  const now = Date.now();
  return {
    status,
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    itemsProcessed: 0,
    summary: "",
  };
}

function startPhase(phase: PhaseResult): PhaseResult {
  const now = Date.now();
  return { ...phase, status: "running", startedAt: now };
}

function completePhase(
  phase: PhaseResult,
  itemsProcessed: number,
  summary: string,
  data?: Record<string, unknown>
): PhaseResult {
  const now = Date.now();
  return {
    ...phase,
    status: "completed",
    completedAt: now,
    durationMs: now - phase.startedAt,
    itemsProcessed,
    summary,
    ...(data ? { data } : {}),
  };
}

function failPhase(phase: PhaseResult, error: string): PhaseResult {
  const now = Date.now();
  return {
    ...phase,
    status: "failed",
    completedAt: now,
    durationMs: now - phase.startedAt,
    summary: `Failed: ${error}`,
    error,
  };
}

function skipPhase(phase: PhaseResult, reason: string): PhaseResult {
  const now = Date.now();
  return {
    ...phase,
    status: "skipped",
    completedAt: now,
    durationMs: 0,
    summary: reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Row <-> VerificationCycle mapping
// ─────────────────────────────────────────────────────────────────────────────

function rowToVerificationCycle(row: VerificationCycleRow): VerificationCycle {
  const emptyPhase = makePhase("skipped");
  const emptyPhases: VerificationCyclePhases = {
    discovery: emptyPhase,
    scoring: emptyPhase,
    verification: emptyPhase,
    cognition: emptyPhase,
    evolve: emptyPhase,
    convergence: emptyPhase,
  };

  return {
    cycleId: row.cycleId,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? null,
    status: row.status,
    phases: (row.phases as VerificationCyclePhases | null) ?? emptyPhases,
    candidatesDiscovered: row.candidatesDiscovered,
    candidatesScored: row.candidatesScored,
    claimsVerified: row.claimsVerified,
    cognitionItemsAdded: row.cognitionItemsAdded,
    evolveStepName: row.evolveStepName ?? null,
    evolveScore: row.evolveScore ?? null,
    convergenceReached: row.convergenceReached,
    bestPic50: row.bestPic50 ?? null,
    errorMessage: row.errorMessage ?? null,
    durationMs: row.durationMs ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run one complete 6-phase verification cycle.
 * Persists state to the `verification_cycles` table.
 * Never throws — all errors are captured in the returned cycle.
 */
export async function runVerificationCycle(): Promise<VerificationCycle> {
  const cycleId = randomUUID();
  const globalStart = Date.now();

  // Initialise all phases as pending
  const phases: VerificationCyclePhases = {
    discovery:    makePhase("pending"),
    scoring:      makePhase("pending"),
    verification: makePhase("pending"),
    cognition:    makePhase("pending"),
    evolve:       makePhase("pending"),
    convergence:  makePhase("pending"),
  };

  // Summary stats (updated as phases complete)
  let candidatesDiscovered = 0;
  let candidatesScored = 0;
  let claimsVerified = 0;
  let cognitionItemsAdded = 0;
  let evolveStepName: string | null = null;
  let evolveScore: number | null = null;
  let convergenceReached = false;
  let bestPic50: number | null = null;
  let errorMessage: string | null = null;

  const db = await getDb();

  // Persist initial row (status = running)
  if (db) {
    try {
      await db.insert(verificationCyclesTable).values({
        cycleId,
        status: "running",
        phases,
        candidatesDiscovered: 0,
        candidatesScored: 0,
        claimsVerified: 0,
        cognitionItemsAdded: 0,
        convergenceReached: false,
      });
    } catch (err) {
      console.warn("[VerificationCycle] Failed to persist initial row:", err);
    }
  }

  const persistProgress = async (status: "running" | "completed" | "failed") => {
    if (!db) return;
    try {
      await db
        .update(verificationCyclesTable)
        .set({
          status,
          phases,
          candidatesDiscovered,
          candidatesScored,
          claimsVerified,
          cognitionItemsAdded,
          evolveStepName: evolveStepName ?? undefined,
          evolveScore: evolveScore ?? undefined,
          convergenceReached,
          bestPic50: bestPic50 ?? undefined,
          errorMessage: errorMessage ?? undefined,
          ...(status !== "running"
            ? {
                completedAt: new Date(),
                durationMs: Date.now() - globalStart,
              }
            : {}),
        })
        .where(eq(verificationCyclesTable.cycleId, cycleId));
    } catch (err) {
      console.warn("[VerificationCycle] Failed to persist progress:", err);
    }
  };

  // ── Phase 1: DISCOVER ──────────────────────────────────────────────────────
  console.log(`[VerificationCycle ${cycleId}] Phase 1: DISCOVER`);
  phases.discovery = startPhase(phases.discovery);

  let discoveredSmiles: string[] = [];
  let discoveryReport: Awaited<ReturnType<typeof pythonBridge.query>> | null = null;

  try {
    discoveryReport = await pythonBridge.query({
      query: "HIV protease inhibitor small molecule binding affinity pIC50",
      domains: ["molecular", "structural_biology", "literature"],
      useQuantum: false,
      maxResults: 50,
    });

    // Extract SMILES from Python discovery results
    discoveredSmiles = (discoveryReport.topResults ?? [])
      .map((r) => r.smiles)
      .filter((s): s is string => typeof s === "string" && s.length > 0);

    candidatesDiscovered = discoveredSmiles.length;
    phases.discovery = completePhase(
      phases.discovery,
      candidatesDiscovered,
      `Queried 65 sources via Python bridge: ${discoveryReport.totalRecords} total records, ` +
        `${candidatesDiscovered} SMILES extracted (backend: ${discoveryReport.backendUsed})`,
      {
        totalRecords: discoveryReport.totalRecords,
        sourceBreakdown: discoveryReport.sourceBreakdown,
        backendUsed: discoveryReport.backendUsed,
        elapsedMs: discoveryReport.elapsedMs,
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    phases.discovery = failPhase(phases.discovery, msg);
    console.error(`[VerificationCycle ${cycleId}] Phase 1 failed:`, msg);
    // Non-fatal: continue with empty discovery set
  }

  await persistProgress("running");

  // ── Phase 2: SCORE ─────────────────────────────────────────────────────────
  console.log(`[VerificationCycle ${cycleId}] Phase 2: SCORE`);
  phases.scoring = startPhase(phases.scoring);

  // Combine Python-discovered SMILES with 4-track engineer output
  interface ScoredCandidate {
    smiles: string;
    track: string;
    pic50: number;
    confidence: number;
    ensembleStd: number;
    quantumScoreVal: number;
    pic50Vqe: number | null;
    hardware: string;
  }

  let scoredCandidates: ScoredCandidate[] = [];

  try {
    // Generate candidates from 4-track engineer (cycle-number-agnostic)
    const knownSmiles = new Set(discoveredSmiles);
    const generated = await generateAllTracks(0, knownSmiles);
    const druglike = filterDruglike(generated);

    // Merge with Python-discovered SMILES
    const allSmiles = [
      ...druglike.map((c) => c.smiles),
      ...discoveredSmiles,
    ];
    const uniqueSmiles = Array.from(new Set(allSmiles));

    // ML ensemble scoring
    await trainEnsemble();
    const predictions = await predictBatch(uniqueSmiles);

    // Quantum VQE scoring for top candidates
    const wukongKey = process.env.WUKONG_API_KEY;
    const quafuKey = process.env.QUAFU_API_KEY;

    const scored = await Promise.all(
      uniqueSmiles.map(async (smiles, i) => {
        const pred = predictions[i];
        if (!pred) return null;

        const qResult = await quantumScore(smiles, pred.pic50, wukongKey, quafuKey);

        // Determine track (from engineer output or "python" for discovered)
        const engineerCandidate = druglike.find((c) => c.smiles === smiles);
        const track = engineerCandidate?.track ?? "A";

        return {
          smiles,
          track,
          pic50: pred.pic50,
          confidence: pred.confidence,
          ensembleStd: pred.ensembleStd,
          quantumScoreVal: qResult.quantumScore,
          pic50Vqe: qResult.pic50Vqe,
          hardware: qResult.hardware,
        } as ScoredCandidate;
      })
    );

    scoredCandidates = scored.filter((c): c is ScoredCandidate => c !== null);
    candidatesScored = scoredCandidates.length;

    if (scoredCandidates.length > 0) {
      bestPic50 = Math.max(...scoredCandidates.map((c) => c.pic50));
    }

    phases.scoring = completePhase(
      phases.scoring,
      candidatesScored,
      `Scored ${candidatesScored} candidates: best pIC50=${bestPic50?.toFixed(2) ?? "N/A"}, ` +
        `${druglike.length} from 4-track engineer, ${discoveredSmiles.length} from Python bridge`,
      { bestPic50, engineerCount: druglike.length, pythonCount: discoveredSmiles.length }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    phases.scoring = failPhase(phases.scoring, msg);
    console.error(`[VerificationCycle ${cycleId}] Phase 2 failed:`, msg);
  }

  await persistProgress("running");

  // ── Phase 3: VERIFY ────────────────────────────────────────────────────────
  console.log(`[VerificationCycle ${cycleId}] Phase 3: VERIFY`);
  phases.verification = startPhase(phases.verification);

  interface VerificationResult {
    smiles: string;
    claim: string;
    verdict: string;
    confidence: number;
    scoreModifier: number;
  }

  let verificationResults: VerificationResult[] = [];

  try {
    if (scoredCandidates.length === 0) {
      phases.verification = skipPhase(
        phases.verification,
        "No scored candidates to verify"
      );
    } else {
      // Take top-10 by pIC50
      const top10 = [...scoredCandidates]
        .sort((a, b) => b.pic50 - a.pic50)
        .slice(0, 10);

      const verifyResults = await Promise.all(
        top10.map(async (candidate, idx) => {
          const claim = buildCandidateClaim({
            name: `Candidate-${idx + 1}`,
            smiles: candidate.smiles,
            pic50: candidate.pic50,
            track: candidate.track,
          });

          const result = await verifyClaim(claim);
          if (!result) return null;

          return {
            smiles: candidate.smiles,
            claim,
            verdict: result.verdict,
            confidence: result.confidenceScore,
            scoreModifier: verdictScoreModifier(result.verdict),
          } as VerificationResult;
        })
      );

      verificationResults = verifyResults.filter(
        (r): r is VerificationResult => r !== null
      );
      claimsVerified = verificationResults.length;

      const supportedCount = verificationResults.filter(
        (r) => r.verdict === "Supported"
      ).length;
      const contradictedCount = verificationResults.filter(
        (r) => r.verdict === "Contradicted"
      ).length;

      phases.verification = completePhase(
        phases.verification,
        claimsVerified,
        `Verified ${claimsVerified}/${top10.length} claims: ` +
          `${supportedCount} Supported, ${contradictedCount} Contradicted`,
        { supportedCount, contradictedCount, verificationRate: claimsVerified / top10.length }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    phases.verification = failPhase(phases.verification, msg);
    console.error(`[VerificationCycle ${cycleId}] Phase 3 failed:`, msg);
  }

  await persistProgress("running");

  // ── Phase 4: COGNITION ─────────────────────────────────────────────────────
  console.log(`[VerificationCycle ${cycleId}] Phase 4: COGNITION`);
  phases.cognition = startPhase(phases.cognition);

  try {
    if (verificationResults.length === 0) {
      phases.cognition = skipPhase(
        phases.cognition,
        "No verification results to feed into cognition store"
      );
    } else {
      const runId = await getOrCreateRun();
      let added = 0;

      for (const vr of verificationResults) {
        const content =
          `[Citation Verdict | ${vr.verdict}] ${vr.claim} ` +
          `(confidence: ${(vr.confidence * 100).toFixed(0)}%, ` +
          `score modifier: ${vr.scoreModifier >= 0 ? "+" : ""}${vr.scoreModifier})`;

        await addCognitionItem({
          run_id: runId,
          content: content.slice(0, 1000),
          source: `citation_verdict:${vr.verdict}:${vr.smiles.slice(0, 20)}`,
          source_type: "manual",
          embedding: [],
          created_at: Date.now(),
          metadata: {
            verdict: vr.verdict,
            confidence: vr.confidence,
            scoreModifier: vr.scoreModifier,
            smiles: vr.smiles,
            claim: vr.claim.slice(0, 200),
            phase: "verification_cycle",
          },
        });
        added++;
      }

      cognitionItemsAdded = added;
      phases.cognition = completePhase(
        phases.cognition,
        added,
        `Fed ${added} citation verdicts into evolve_cognition (run_id=${runId})`,
        { runId, added }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    phases.cognition = failPhase(phases.cognition, msg);
    console.error(`[VerificationCycle ${cycleId}] Phase 4 failed:`, msg);
  }

  await persistProgress("running");

  // ── Phase 5: EVOLVE ────────────────────────────────────────────────────────
  console.log(`[VerificationCycle ${cycleId}] Phase 5: EVOLVE`);
  phases.evolve = startPhase(phases.evolve);

  try {
    const evolveResult = await runEvolveStep();

    evolveStepName = evolveResult.step_name;
    evolveScore = evolveResult.score;

    phases.evolve = completePhase(
      phases.evolve,
      1,
      `ASI-Evolve ${evolveResult.step_name}: score=${evolveResult.score.toFixed(3)}, ` +
        `best_pic50=${evolveResult.best_pic50.toFixed(2)}, ` +
        `new_best=${evolveResult.is_new_best}, ` +
        `cognition_added=${evolveResult.cognition_added}`,
      {
        step_name: evolveResult.step_name,
        score: evolveResult.score,
        best_pic50: evolveResult.best_pic50,
        is_new_best: evolveResult.is_new_best,
        cognition_added: evolveResult.cognition_added,
        elapsed_ms: evolveResult.elapsed_ms,
        sampling_algorithm: evolveResult.sampling_algorithm,
        used_diff_mode: evolveResult.used_diff_mode,
        manager_ran: evolveResult.manager_ran,
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    phases.evolve = failPhase(phases.evolve, msg);
    console.error(`[VerificationCycle ${cycleId}] Phase 5 failed:`, msg);
  }

  await persistProgress("running");

  // ── Phase 6: CONVERGENCE ───────────────────────────────────────────────────
  console.log(`[VerificationCycle ${cycleId}] Phase 6: CONVERGENCE`);
  phases.convergence = startPhase(phases.convergence);

  try {
    // Determine current day from DB cycle count
    let dayNumber = 1;
    let cycleNumber = 1;
    if (db) {
      try {
        const { cycles: cyclesTable } = await import("../../drizzle/schema");
        const { count } = await import("drizzle-orm");
        const [cycleCountRow] = await db.select({ count: count() }).from(cyclesTable);
        cycleNumber = (cycleCountRow?.count ?? 0) + 1;
        dayNumber = Math.ceil(cycleNumber / 6);
      } catch {
        // Non-fatal: use defaults
      }
    }

    if (!shouldRunConvergence(dayNumber)) {
      phases.convergence = skipPhase(
        phases.convergence,
        `Convergence analysis starts from Day 7 (current: Day ${dayNumber})`
      );
    } else if (scoredCandidates.length === 0) {
      phases.convergence = skipPhase(
        phases.convergence,
        "No scored candidates available for convergence analysis"
      );
    } else {
      const trackResults: TrackResult[] = scoredCandidates.map((c) => ({
        track: (c.track as "A" | "B" | "C" | "D") ?? "A",
        smiles: c.smiles,
        pic50: c.pic50,
        ensembleStd: c.ensembleStd,
        confidence: c.confidence,
      }));

      const report = await detectConvergence(trackResults, cycleNumber, dayNumber);
      convergenceReached = report.convergenceCandidates.length > 0;

      // Update loop_state via cognitionStore if convergence found
      if (convergenceReached && db) {
        try {
          const { cognitionStore } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(cognitionStore)
            .set({
              statisticalPatterns: {
                convergence: {
                  cycleNumber,
                  dayNumber,
                  candidateCount: report.convergenceCandidates.length,
                  bestConvergenceScore: report.bestCandidate?.convergenceScore ?? 0,
                  timestamp: new Date().toISOString(),
                },
              },
            })
            .where(eq(cognitionStore.targetChemblId, "CHEMBL247"));
        } catch {
          // Non-fatal: convergence detection still succeeded
        }
      }

      phases.convergence = completePhase(
        phases.convergence,
        report.convergenceCandidates.length,
        `Day ${dayNumber}, Cycle ${cycleNumber}: ` +
          `${report.convergenceCandidates.length} convergence candidates from ${report.totalCandidates} total. ` +
          (convergenceReached
            ? `Best convergence score: ${report.bestCandidate?.convergenceScore.toFixed(3)}`
            : "No convergence candidates yet."),
        {
          dayNumber,
          cycleNumber,
          convergenceCandidates: report.convergenceCandidates.length,
          bestConvergenceScore: report.bestCandidate?.convergenceScore ?? 0,
          bestCandidate: report.bestCandidate?.smiles ?? null,
        }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    phases.convergence = failPhase(phases.convergence, msg);
    console.error(`[VerificationCycle ${cycleId}] Phase 6 failed:`, msg);
  }

  // ── Finalise ───────────────────────────────────────────────────────────────
  const allFailed =
    phases.discovery.status === "failed" &&
    phases.scoring.status === "failed" &&
    phases.evolve.status === "failed";

  const finalStatus: "completed" | "failed" = allFailed ? "failed" : "completed";

  if (allFailed) {
    errorMessage = "All critical phases failed";
  }

  await persistProgress(finalStatus);

  const durationMs = Date.now() - globalStart;

  console.log(
    `[VerificationCycle ${cycleId}] ${finalStatus.toUpperCase()} in ${durationMs}ms. ` +
      `discovered=${candidatesDiscovered}, scored=${candidatesScored}, ` +
      `verified=${claimsVerified}, cognition+=${cognitionItemsAdded}, ` +
      `evolve=${evolveStepName ?? "none"}, convergence=${convergenceReached}`
  );

  return {
    cycleId,
    startedAt: new Date(globalStart),
    completedAt: new Date(),
    status: finalStatus,
    phases,
    candidatesDiscovered,
    candidatesScored,
    claimsVerified,
    cognitionItemsAdded,
    evolveStepName,
    evolveScore,
    convergenceReached,
    bestPic50,
    errorMessage,
    durationMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers for tRPC procedures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch paginated verification cycle history from the database.
 */
export async function getVerificationCycles(
  page = 1,
  pageSize = 20
): Promise<{ items: VerificationCycle[]; total: number; page: number; pageSize: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0, page, pageSize };

  const { count } = await import("drizzle-orm");
  const offset = (page - 1) * pageSize;

  const [totalRow, rows] = await Promise.all([
    db.select({ count: count() }).from(verificationCyclesTable),
    db
      .select()
      .from(verificationCyclesTable)
      .orderBy(desc(verificationCyclesTable.startedAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  return {
    items: rows.map(rowToVerificationCycle),
    total: totalRow[0]?.count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Fetch the most recent verification cycle.
 */
export async function getLatestVerificationCycle(): Promise<VerificationCycle | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(verificationCyclesTable)
    .orderBy(desc(verificationCyclesTable.startedAt))
    .limit(1);

  if (rows.length === 0) return null;
  return rowToVerificationCycle(rows[0]);
}
