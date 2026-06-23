/**
 * report-generator.ts — Day-30 Scientific Report Generator
 *
 * Produces a structured snapshot of the HIV protease discovery campaign.
 * Works with any amount of accumulated data (Day 1 through Day 30+).
 * The report is returned as both a JSON payload and a Markdown document.
 *
 * Data sources queried:
 *   - verification_cycles   (6-phase cycle history)
 *   - candidates            (scored molecules)
 *   - cycles                (legacy loop cycles)
 *   - dailyLogs             (per-day summaries)
 *   - domain_cycle_summaries (12-domain stats)
 *   - corpus                (seed molecules)
 *   - cognitionStore        (best-ever metrics)
 *   - evolve_nodes          (ASI-Evolve best steps)
 */

import { getDb } from "../db";
import {
  verificationCycles as verificationCyclesTable,
  candidates as candidatesTable,
  cycles as cyclesTable,
  dailyLogs,
  domainCycleSummaries,
  corpus as corpusTable,
  cognitionStore,
  evolveNodes,
  evolveRuns,
} from "../../drizzle/schema";
import { eq, desc, asc, and, gte, count, avg, max, min, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface TopCandidate {
  rank: number;
  smiles: string;
  track: string;
  pic50Predicted: number;
  confidenceScore: number;
  pic50Vqe: number | null;
  quantumHardware: string | null;
  mw: number | null;
  logp: number | null;
  tpsa: number | null;
  lipinskiViolations: number | null;
  isDruglike: boolean;
  citationVerdict: string | null;
  citationConfidence: number | null;
  citationGatePassed: boolean;
  isBestSoFar: boolean;
  noveltyFlag: boolean;
}

export interface DomainSummary {
  domainId: string;
  totalCycles: number;
  totalClaimsVerified: number;
  totalSupported: number;
  totalContradicted: number;
  totalAmbiguous: number;
  bestPic50: number | null;
  supportRate: number; // 0–1
}

export interface CycleSummary {
  totalCycles: number;
  completedCycles: number;
  failedCycles: number;
  avgDurationMs: number;
  totalCandidatesDiscovered: number;
  totalCandidatesScored: number;
  totalClaimsVerified: number;
  totalCognitionItemsAdded: number;
  convergenceReachedCount: number;
  bestPic50Across: number | null;
}

export interface ReportPayload {
  generatedAt: string;         // ISO-8601 UTC
  generatedAtMs: number;       // epoch ms
  dayNumber: number;
  campaignStartEstimate: string | null; // ISO date of first cycle
  campaignDays: number;        // calendar days since first cycle

  // Executive summary
  executive: {
    totalCycles: number;
    totalCandidates: number;
    corpusSize: number;
    bestPic50: number;
    bestSmiles: string | null;
    convergenceCandidates: number;
    domainsActive: number;
    claimsVerified: number;
    supportRate: number;
  };

  // Top 10 convergence candidates
  topCandidates: TopCandidate[];

  // Per-domain breakdown
  domainBreakdown: DomainSummary[];

  // 6-phase cycle aggregate stats
  cycleSummary: CycleSummary;

  // Daily progression (last 30 days)
  dailyProgression: Array<{
    dayNumber: number;
    date: string;
    cycleCount: number;
    bestPic50: number | null;
    summary: string | null;
  }>;

  // ASI-Evolve best step
  bestEvolveStep: {
    stepName: string;
    name: string;
    score: number;
    evalScore: number;
    analysis: string | null;
    citationVerdict: string | null;
  } | null;

  // Methodology note
  methodology: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main generator
// ─────────────────────────────────────────────────────────────────────────────

export async function generateReport(
  opts: { topN?: number; dayWindowDays?: number } = {}
): Promise<ReportPayload> {
  const { topN = 10, dayWindowDays = 30 } = opts;
  const now = Date.now();
  const db = await getDb();

  if (!db) {
    // Return a minimal empty report when DB is unavailable
    return buildEmptyReport(now);
  }

  // ── 1. Cognition store (best-ever metrics) ──────────────────────────────────
  const [cognitionRow] = await db
    .select()
    .from(cognitionStore)
    .where(eq(cognitionStore.targetChemblId, "CHEMBL247"))
    .limit(1);

  const dayNumber = cognitionRow?.dayNumber ?? 1;
  const bestPic50 = cognitionRow?.bestPic50Ever ?? 0;
  const bestSmiles = cognitionRow?.bestSmilsEver ?? null;

  // ── 2. Corpus size ──────────────────────────────────────────────────────────
  const [corpusStat] = await db.select({ count: count() }).from(corpusTable);
  const corpusSize = corpusStat?.count ?? 0;

  // ── 3. Top N candidates (by pIC50 descending, drug-like preferred) ──────────
  const rawCandidates = await db
    .select()
    .from(candidatesTable)
    .orderBy(desc(candidatesTable.pic50Predicted))
    .limit(topN * 3); // over-fetch to allow drug-like filtering

  // Prefer drug-like, then fill with non-drug-like if needed
  const drugLike = rawCandidates.filter((c) => c.isDruglike);
  const nonDrugLike = rawCandidates.filter((c) => !c.isDruglike);
  const merged = [...drugLike, ...nonDrugLike].slice(0, topN);

  const topCandidates: TopCandidate[] = merged.map((c, i) => ({
    rank: i + 1,
    smiles: c.smiles,
    track: c.track,
    pic50Predicted: c.pic50Predicted ?? 0,
    confidenceScore: c.confidenceScore ?? 0,
    pic50Vqe: c.pic50Vqe ?? null,
    quantumHardware: c.quantumHardware ?? null,
    mw: c.mw ?? null,
    logp: c.logp ?? null,
    tpsa: c.tpsa ?? null,
    lipinskiViolations: c.lipinskiViolations ?? null,
    isDruglike: c.isDruglike ?? false,
    citationVerdict: c.citationVerdict ?? null,
    citationConfidence: c.citationConfidence ?? null,
    citationGatePassed: c.citationGatePassed ?? false,
    isBestSoFar: c.isBestSoFar ?? false,
    noveltyFlag: c.isNovel ?? true,
  }));

  // ── 4. Verification cycle aggregate stats ───────────────────────────────────
  const allCycles = await db
    .select()
    .from(verificationCyclesTable)
    .orderBy(asc(verificationCyclesTable.startedAt));

  const completedCycles = allCycles.filter((c) => c.status === "completed");
  const failedCycles = allCycles.filter((c) => c.status === "failed");

  const campaignStartEstimate =
    allCycles[0]?.startedAt?.toISOString().split("T")[0] ?? null;
  const campaignDays = campaignStartEstimate
    ? Math.max(
        1,
        Math.ceil(
          (now - new Date(campaignStartEstimate).getTime()) / 86_400_000
        )
      )
    : 1;

  const avgDurationMs =
    completedCycles.length > 0
      ? Math.round(
          completedCycles.reduce((s, c) => s + (c.durationMs ?? 0), 0) /
            completedCycles.length
        )
      : 0;

  const totalCandidatesDiscovered = allCycles.reduce(
    (s, c) => s + (c.candidatesDiscovered ?? 0),
    0
  );
  const totalCandidatesScored = allCycles.reduce(
    (s, c) => s + (c.candidatesScored ?? 0),
    0
  );
  const totalClaimsVerified = allCycles.reduce(
    (s, c) => s + (c.claimsVerified ?? 0),
    0
  );
  const totalCognitionItemsAdded = allCycles.reduce(
    (s, c) => s + (c.cognitionItemsAdded ?? 0),
    0
  );
  const convergenceReachedCount = allCycles.filter(
    (c) => c.convergenceReached
  ).length;

  const bestPic50Across =
    allCycles.reduce((best, c) => {
      if (c.bestPic50 !== null && c.bestPic50 !== undefined) {
        return Math.max(best, c.bestPic50);
      }
      return best;
    }, 0) || null;

  const cycleSummary: CycleSummary = {
    totalCycles: allCycles.length,
    completedCycles: completedCycles.length,
    failedCycles: failedCycles.length,
    avgDurationMs,
    totalCandidatesDiscovered,
    totalCandidatesScored,
    totalClaimsVerified,
    totalCognitionItemsAdded,
    convergenceReachedCount,
    bestPic50Across: bestPic50Across ?? null,
  };

  // ── 5. Domain breakdown ─────────────────────────────────────────────────────
  const domainRows = await db
    .select()
    .from(domainCycleSummaries)
    .orderBy(desc(domainCycleSummaries.cyclesCompleted));

  // Aggregate across all dates per domain
  const domainMap = new Map<string, DomainSummary>();
  for (const row of domainRows) {
    const existing = domainMap.get(row.domainId);
    if (!existing) {
      domainMap.set(row.domainId, {
        domainId: row.domainId,
        totalCycles: row.cyclesCompleted + row.cyclesFailed,
        totalClaimsVerified: row.totalClaimsVerified,
        totalSupported: row.totalSupported,
        totalContradicted: row.totalContradicted,
        totalAmbiguous: row.totalAmbiguous,
        bestPic50: row.bestPic50 ?? null,
        supportRate: 0,
      });
    } else {
      existing.totalCycles += row.cyclesCompleted + row.cyclesFailed;
      existing.totalClaimsVerified += row.totalClaimsVerified;
      existing.totalSupported += row.totalSupported;
      existing.totalContradicted += row.totalContradicted;
      existing.totalAmbiguous += row.totalAmbiguous;
      if (row.bestPic50 !== null && row.bestPic50 !== undefined) {
        existing.bestPic50 = Math.max(existing.bestPic50 ?? 0, row.bestPic50);
      }
    }
  }
  // Compute support rate
  for (const d of Array.from(domainMap.values())) {
    const total = d.totalSupported + d.totalContradicted + d.totalAmbiguous;
    d.supportRate = total > 0 ? d.totalSupported / total : 0;
  }
  const domainBreakdown = Array.from(domainMap.values()).sort(
    (a, b) => (b.bestPic50 ?? 0) - (a.bestPic50 ?? 0)
  );

  // ── 6. Daily progression ────────────────────────────────────────────────────
  const dailyLogRows = await db
    .select()
    .from(dailyLogs)
    .orderBy(desc(dailyLogs.dayNumber))
    .limit(dayWindowDays);

  const dailyProgression = dailyLogRows
    .reverse()
    .map((row) => ({
      dayNumber: row.dayNumber,
      date: row.createdAt?.toISOString().split("T")[0] ?? "",
      cycleCount: row.cycleCount,
      bestPic50:
        (row.runData as Record<string, unknown> | null)?.bestPic50 as
          | number
          | null ?? null,
      summary: row.summary ?? null,
    }));

  // ── 7. ASI-Evolve best step ─────────────────────────────────────────────────
  const bestNodes = await db
    .select()
    .from(evolveNodes)
    .where(eq(evolveNodes.isBest, true))
    .orderBy(desc(evolveNodes.evalScore))
    .limit(1);

  const bestEvolveStep = bestNodes[0]
    ? {
        stepName: bestNodes[0].stepName,
        name: bestNodes[0].name,
        score: bestNodes[0].score,
        evalScore: bestNodes[0].evalScore,
        analysis: bestNodes[0].analysis ?? null,
        citationVerdict: bestNodes[0].citationVerdict ?? null,
      }
    : null;

  // ── 8. Executive summary ────────────────────────────────────────────────────
  const totalCandidatesCount = await db
    .select({ count: count() })
    .from(candidatesTable);

  const globalSupportRate =
    totalClaimsVerified > 0
      ? domainBreakdown.reduce((s, d) => s + d.totalSupported, 0) /
        totalClaimsVerified
      : 0;

  const executive = {
    totalCycles: allCycles.length,
    totalCandidates: totalCandidatesCount[0]?.count ?? 0,
    corpusSize,
    bestPic50,
    bestSmiles,
    convergenceCandidates: convergenceReachedCount,
    domainsActive: domainBreakdown.filter((d) => d.totalCycles > 0).length,
    claimsVerified: totalClaimsVerified,
    supportRate: globalSupportRate,
  };

  return {
    generatedAt: new Date(now).toISOString(),
    generatedAtMs: now,
    dayNumber,
    campaignStartEstimate,
    campaignDays,
    executive,
    topCandidates,
    domainBreakdown,
    cycleSummary,
    dailyProgression,
    bestEvolveStep,
    methodology: buildMethodologyNote(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown renderer
// ─────────────────────────────────────────────────────────────────────────────

export function renderReportMarkdown(report: ReportPayload): string {
  const lines: string[] = [];

  const fmt = (n: number | null | undefined, decimals = 2) =>
    n !== null && n !== undefined ? n.toFixed(decimals) : "—";

  lines.push(
    `# notus.is — HIV Protease Discovery Report`,
    ``,
    `**Generated:** ${report.generatedAt}  `,
    `**Campaign Day:** ${report.dayNumber}  `,
    `**Calendar Days Since First Cycle:** ${report.campaignDays}  `,
    `**Campaign Start:** ${report.campaignStartEstimate ?? "Not yet started"}`,
    ``
  );

  // Executive summary
  lines.push(
    `## Executive Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Verification Cycles | ${report.executive.totalCycles} |`,
    `| Total Candidates Evaluated | ${report.executive.totalCandidates} |`,
    `| Corpus Size (seed molecules) | ${report.executive.corpusSize} |`,
    `| Best pIC50 (predicted) | ${fmt(report.executive.bestPic50)} |`,
    `| Best SMILES | \`${report.executive.bestSmiles ?? "—"}\` |`,
    `| Convergence Events | ${report.executive.convergenceCandidates} |`,
    `| Active Scientific Domains | ${report.executive.domainsActive} |`,
    `| Total Claims Verified | ${report.executive.claimsVerified} |`,
    `| Citation Support Rate | ${(report.executive.supportRate * 100).toFixed(1)}% |`,
    ``
  );

  // 6-phase cycle stats
  const cs = report.cycleSummary;
  lines.push(
    `## 6-Phase Verification Cycle Statistics`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Cycles Run | ${cs.totalCycles} |`,
    `| Completed | ${cs.completedCycles} |`,
    `| Failed | ${cs.failedCycles} |`,
    `| Avg Duration | ${(cs.avgDurationMs / 1000).toFixed(1)} s |`,
    `| Candidates Discovered (total) | ${cs.totalCandidatesDiscovered} |`,
    `| Candidates Scored (total) | ${cs.totalCandidatesScored} |`,
    `| Claims Verified (total) | ${cs.totalClaimsVerified} |`,
    `| Cognition Items Added | ${cs.totalCognitionItemsAdded} |`,
    `| Convergence Reached | ${cs.convergenceReachedCount} |`,
    `| Best pIC50 Across All Cycles | ${fmt(cs.bestPic50Across)} |`,
    ``
  );

  // Top candidates
  if (report.topCandidates.length > 0) {
    lines.push(`## Top ${report.topCandidates.length} Convergence Candidates`, ``);
    lines.push(
      `| Rank | Track | pIC50 | Conf | VQE pIC50 | MW | LogP | TPSA | Lipinski | Drug-like | Citation | Best |`,
      `|------|-------|-------|------|-----------|-----|------|------|----------|-----------|----------|------|`
    );
    for (const c of report.topCandidates) {
      lines.push(
        `| ${c.rank} | ${c.track} | ${fmt(c.pic50Predicted)} | ${fmt(c.confidenceScore)} | ${fmt(c.pic50Vqe)} | ${fmt(c.mw, 1)} | ${fmt(c.logp)} | ${fmt(c.tpsa, 1)} | ${c.lipinskiViolations ?? "—"} | ${c.isDruglike ? "✓" : "✗"} | ${c.citationVerdict ?? "—"} | ${c.isBestSoFar ? "★" : ""} |`
      );
    }
    lines.push(``);

    // SMILES detail block
    lines.push(`### SMILES Strings`, ``);
    for (const c of report.topCandidates) {
      lines.push(`**Rank ${c.rank} (Track ${c.track}):** \`${c.smiles}\`  `);
    }
    lines.push(``);
  } else {
    lines.push(
      `## Top Candidates`,
      ``,
      `_No candidates have been generated yet. The discovery loop will populate this section as cycles complete._`,
      ``
    );
  }

  // Domain breakdown
  if (report.domainBreakdown.length > 0) {
    lines.push(`## Scientific Domain Breakdown`, ``);
    lines.push(
      `| Domain | Cycles | Claims | Supported | Contradicted | Ambiguous | Support Rate | Best pIC50 |`,
      `|--------|--------|--------|-----------|--------------|-----------|--------------|------------|`
    );
    for (const d of report.domainBreakdown) {
      lines.push(
        `| ${d.domainId} | ${d.totalCycles} | ${d.totalClaimsVerified} | ${d.totalSupported} | ${d.totalContradicted} | ${d.totalAmbiguous} | ${(d.supportRate * 100).toFixed(1)}% | ${fmt(d.bestPic50)} |`
      );
    }
    lines.push(``);
  }

  // Daily progression
  if (report.dailyProgression.length > 0) {
    lines.push(`## Daily Progression`, ``);
    lines.push(
      `| Day | Date | Cycles | Best pIC50 | Summary |`,
      `|-----|------|--------|------------|---------|`
    );
    for (const d of report.dailyProgression) {
      const summary = (d.summary ?? "").replace(/\|/g, "\\|").slice(0, 80);
      lines.push(
        `| ${d.dayNumber} | ${d.date} | ${d.cycleCount} | ${fmt(d.bestPic50)} | ${summary} |`
      );
    }
    lines.push(``);
  }

  // ASI-Evolve best step
  if (report.bestEvolveStep) {
    const es = report.bestEvolveStep;
    lines.push(
      `## ASI-Evolve Best Step`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| Step Name | ${es.stepName} |`,
      `| Name | ${es.name} |`,
      `| Score | ${fmt(es.score)} |`,
      `| Eval Score | ${fmt(es.evalScore)} |`,
      `| Citation Verdict | ${es.citationVerdict ?? "—"} |`,
      ``
    );
    if (es.analysis) {
      lines.push(`**Analysis:**`, ``, `> ${es.analysis.slice(0, 500)}`, ``);
    }
  }

  // Methodology
  lines.push(`## Methodology`, ``, report.methodology, ``);

  // Footer
  lines.push(
    `---`,
    ``,
    `*Report generated by notus.is — Autonomous HIV Protease Discovery Engine.*  `,
    `*Powered by ASI-Evolve cognition loop, WuKong quantum scoring, and citation.manus.space verification.*`
  );

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildEmptyReport(now: number): ReportPayload {
  return {
    generatedAt: new Date(now).toISOString(),
    generatedAtMs: now,
    dayNumber: 1,
    campaignStartEstimate: null,
    campaignDays: 1,
    executive: {
      totalCycles: 0,
      totalCandidates: 0,
      corpusSize: 0,
      bestPic50: 0,
      bestSmiles: null,
      convergenceCandidates: 0,
      domainsActive: 0,
      claimsVerified: 0,
      supportRate: 0,
    },
    topCandidates: [],
    domainBreakdown: [],
    cycleSummary: {
      totalCycles: 0,
      completedCycles: 0,
      failedCycles: 0,
      avgDurationMs: 0,
      totalCandidatesDiscovered: 0,
      totalCandidatesScored: 0,
      totalClaimsVerified: 0,
      totalCognitionItemsAdded: 0,
      convergenceReachedCount: 0,
      bestPic50Across: null,
    },
    dailyProgression: [],
    bestEvolveStep: null,
    methodology: buildMethodologyNote(),
  };
}

function buildMethodologyNote(): string {
  return `notus.is runs a 6-phase autonomous discovery-verification loop (DISCOVER → SCORE → VERIFY → COGNITION → EVOLVE → CONVERGENCE) every 4 hours across 65 data sources and 12 scientific domains. Candidate molecules are generated from four parallel tracks seeded from ChEMBL, PDB co-crystal structures, BindingDB, and diverse scaffold libraries. Each candidate is scored by an ML ensemble (10 models) augmented with quantum VQE scoring via the WuKong/Quafu backends. Top-10 claims per cycle are submitted to citation.manus.space for citation-level truth verification. Verified claims feed back into the ASI-Evolve cognition loop, which uses MAP-Elites island sampling and LLM-guided query evolution to improve discovery quality over time. Convergence is declared when ≥3 tracks independently discover molecules with pIC50 ≥ 9.5 and Tanimoto similarity ≥ 0.8 to each other. The Day-30 report represents the scientific output of this autonomous campaign.`;
}
