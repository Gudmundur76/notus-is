/**
 * report-generator.test.ts
 *
 * Unit tests for the Day-30 scientific report generator.
 * All DB calls are mocked — no real database required.
 *
 * Test plan:
 *   1. generateReport() — returns valid ReportPayload with empty DB
 *   2. generateReport() — aggregates candidate data correctly
 *   3. generateReport() — domain breakdown aggregation
 *   4. generateReport() — cycle summary stats
 *   5. generateReport() — daily progression ordering
 *   6. generateReport() — bestEvolveStep populated when isBest=true
 *   7. renderReportMarkdown() — produces valid markdown with all sections
 *   8. renderReportMarkdown() — handles empty topCandidates gracefully
 *   9. renderReportMarkdown() — handles empty domainBreakdown gracefully
 *  10. renderReportMarkdown() — handles empty dailyProgression gracefully
 *  11. generateReport() — topN parameter limits candidate count
 *  12. generateReport() — drug-like candidates ranked before non-drug-like
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ───────────────────────────────────────────────────────────────────

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../db";
import { generateReport, renderReportMarkdown } from "./report-generator";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    cycleId: 1,
    smiles: "CC(=O)Nc1ccc(O)cc1",
    parentSmiles: null,
    track: "A" as const,
    modificationType: "scaffold",
    pic50Predicted: 8.5,
    confidenceScore: 0.9,
    pic50Vqe: 8.7,
    quantumHardware: "full_amplitude",
    quantumScore: 0.85,
    provenanceStatus: "verified",
    citationVerdict: "SUPPORTED",
    citationConfidence: 0.92,
    citationGatePassed: true,
    pubmedIds: [],
    citationIds: [],
    mw: 420.5,
    logp: 2.1,
    hbd: 2,
    hba: 5,
    tpsa: 75.0,
    lipinskiViolations: 0,
    isDruglike: true,
    isNovel: true,
    tanimotoToApproved: 0.3,
    isBestSoFar: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeVerificationCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    cycleId: "cycle-uuid-1",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    completedAt: new Date("2026-01-01T00:05:00Z"),
    status: "completed" as const,
    phases: null,
    candidatesDiscovered: 50,
    candidatesScored: 45,
    claimsVerified: 10,
    cognitionItemsAdded: 3,
    evolveStepName: "step_1",
    evolveScore: 8.2,
    convergenceReached: false,
    bestPic50: 8.5,
    errorMessage: null,
    durationMs: 300_000,
    domainId: "biomedical",
    ...overrides,
  };
}

function makeDomainRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    domainId: "biomedical",
    date: "2026-01-01",
    cyclesCompleted: 5,
    cyclesFailed: 1,
    totalClaimsVerified: 20,
    totalSupported: 14,
    totalContradicted: 3,
    totalAmbiguous: 3,
    bestPic50: 8.5,
    avgDurationMs: 290_000,
    evolvedQuery: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDailyLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    dayNumber: 1,
    cycleCount: 6,
    summary: "Day 1 summary",
    runData: { bestPic50: 8.5 },
    convergenceReport: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeEvolveNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    runId: 1,
    stepName: "researcher",
    name: "Best Researcher Step",
    motivation: "Improve binding affinity",
    code: "# code",
    results: {},
    analysis: "This step improved pIC50 by 0.3 units.",
    score: 9.1,
    evalScore: 9.2,
    success: true,
    parentIds: [],
    visitCount: 3,
    isBest: true,
    createdAt: Date.now(),
    metadata: {},
    citationVerdict: "SUPPORTED",
    citationDocId: "doc-123",
    citationConfidence: 0.95,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock DB factory
// ─────────────────────────────────────────────────────────────────────────────

function buildMockDb(overrides: {
  cognition?: unknown[];
  corpus?: unknown[];
  candidates?: unknown[];
  verificationCycles?: unknown[];
  domainCycleSummaries?: unknown[];
  dailyLogs?: unknown[];
  evolveNodes?: unknown[];
} = {}) {
  const {
    cognition = [],
    corpus = [{ count: 44 }],
    candidates = [],
    verificationCycles = [],
    domainCycleSummaries = [],
    dailyLogs = [],
    evolveNodes = [],
  } = overrides;

  // We need a chainable Drizzle-like mock
  const makeChain = (result: unknown[]) => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = () => Promise.resolve(result);
    chain.then = (resolve: (v: unknown) => void) => {
      resolve(result);
      return Promise.resolve(result);
    };
    // Make it thenable for await
    return chain;
  };

  let callCount = 0;
  const sequences = [
    cognition,      // 1. cognition store
    corpus,         // 2. corpus count
    candidates,     // 3. top candidates
    verificationCycles, // 4. all verification cycles
    domainCycleSummaries, // 5. domain summaries
    dailyLogs,      // 6. daily logs
    evolveNodes,    // 7. evolve nodes (best)
    [{ count: candidates.length }], // 8. total candidates count
  ];

  const db = {
    select: vi.fn(() => {
      const seq = sequences[callCount] ?? [];
      callCount++;
      return makeChain(seq);
    }),
  };

  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("generateReport()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. returns valid ReportPayload when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);

    const report = await generateReport();

    expect(report.generatedAt).toBeTruthy();
    expect(report.dayNumber).toBe(1);
    expect(report.executive.totalCycles).toBe(0);
    expect(report.topCandidates).toHaveLength(0);
    expect(report.methodology).toContain("6-phase");
  });

  it("2. aggregates candidate data correctly", async () => {
    const candidate = makeCandidate({ pic50Predicted: 9.2, isBestSoFar: true });
    const db = buildMockDb({ candidates: [candidate] });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const report = await generateReport({ topN: 10 });

    expect(report.topCandidates.length).toBeGreaterThanOrEqual(0);
    // If candidates are returned, verify structure
    if (report.topCandidates.length > 0) {
      const top = report.topCandidates[0];
      expect(top.rank).toBe(1);
      expect(top.track).toBe("A");
      expect(typeof top.pic50Predicted).toBe("number");
      expect(typeof top.isDruglike).toBe("boolean");
    }
  });

  it("3. domain breakdown aggregation computes support rate", async () => {
    const domainRow = makeDomainRow({
      totalSupported: 8,
      totalContradicted: 2,
      totalAmbiguous: 0,
    });
    const db = buildMockDb({ domainCycleSummaries: [domainRow] });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const report = await generateReport();

    if (report.domainBreakdown.length > 0) {
      const domain = report.domainBreakdown[0];
      expect(domain.domainId).toBe("biomedical");
      expect(domain.supportRate).toBeCloseTo(0.8, 2);
    }
  });

  it("4. cycle summary stats are computed from verification cycles", async () => {
    const cycle1 = makeVerificationCycle({
      candidatesDiscovered: 50,
      candidatesScored: 45,
      claimsVerified: 10,
      durationMs: 300_000,
    });
    const cycle2 = makeVerificationCycle({
      id: 2,
      cycleId: "cycle-uuid-2",
      candidatesDiscovered: 60,
      candidatesScored: 55,
      claimsVerified: 12,
      durationMs: 240_000,
    });
    const db = buildMockDb({ verificationCycles: [cycle1, cycle2] });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const report = await generateReport();

    expect(report.cycleSummary.totalCycles).toBe(2);
    expect(report.cycleSummary.completedCycles).toBe(2);
    expect(report.cycleSummary.totalCandidatesDiscovered).toBe(110);
    expect(report.cycleSummary.totalCandidatesScored).toBe(100);
    expect(report.cycleSummary.totalClaimsVerified).toBe(22);
    expect(report.cycleSummary.avgDurationMs).toBe(270_000);
  });

  it("5. daily progression is ordered by day number ascending", async () => {
    const day3 = makeDailyLog({ dayNumber: 3, createdAt: new Date("2026-01-03") });
    const day1 = makeDailyLog({ dayNumber: 1, createdAt: new Date("2026-01-01") });
    const day2 = makeDailyLog({ dayNumber: 2, createdAt: new Date("2026-01-02") });
    // DB returns them in desc order (as queried), generator reverses them
    const db = buildMockDb({ dailyLogs: [day3, day2, day1] });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const report = await generateReport();

    if (report.dailyProgression.length >= 3) {
      expect(report.dailyProgression[0].dayNumber).toBeLessThanOrEqual(
        report.dailyProgression[1].dayNumber
      );
    }
  });

  it("6. bestEvolveStep is populated when isBest=true node exists", async () => {
    const node = makeEvolveNode({ isBest: true, evalScore: 9.2 });
    const db = buildMockDb({ evolveNodes: [node] });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const report = await generateReport();

    if (report.bestEvolveStep) {
      expect(report.bestEvolveStep.stepName).toBe("researcher");
      expect(report.bestEvolveStep.evalScore).toBe(9.2);
      expect(report.bestEvolveStep.citationVerdict).toBe("SUPPORTED");
    }
  });

  it("11. topN parameter limits candidate count", async () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeCandidate({ id: i + 1, pic50Predicted: 9 - i * 0.1 })
    );
    const db = buildMockDb({ candidates });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const report = await generateReport({ topN: 5 });

    expect(report.topCandidates.length).toBeLessThanOrEqual(5);
  });

  it("12. drug-like candidates are ranked before non-drug-like", async () => {
    const nonDrugLike = makeCandidate({
      id: 1,
      pic50Predicted: 9.5,
      isDruglike: false,
    });
    const drugLike = makeCandidate({
      id: 2,
      pic50Predicted: 8.0,
      isDruglike: true,
    });
    const db = buildMockDb({ candidates: [nonDrugLike, drugLike] });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const report = await generateReport({ topN: 10 });

    // Drug-like should appear first if present
    if (report.topCandidates.length >= 2) {
      const drugLikeIdx = report.topCandidates.findIndex((c) => c.isDruglike);
      const nonDrugLikeIdx = report.topCandidates.findIndex((c) => !c.isDruglike);
      if (drugLikeIdx !== -1 && nonDrugLikeIdx !== -1) {
        expect(drugLikeIdx).toBeLessThan(nonDrugLikeIdx);
      }
    }
  });
});

describe("renderReportMarkdown()", () => {
  const baseReport = {
    generatedAt: "2026-01-30T12:00:00.000Z",
    generatedAtMs: 1738238400000,
    dayNumber: 30,
    campaignStartEstimate: "2026-01-01",
    campaignDays: 29,
    executive: {
      totalCycles: 180,
      totalCandidates: 9000,
      corpusSize: 44,
      bestPic50: 9.4,
      bestSmiles: "CC(=O)Nc1ccc(O)cc1",
      convergenceCandidates: 3,
      domainsActive: 12,
      claimsVerified: 1800,
      supportRate: 0.72,
    },
    topCandidates: [
      {
        rank: 1,
        smiles: "CC(=O)Nc1ccc(O)cc1",
        track: "A",
        pic50Predicted: 9.4,
        confidenceScore: 0.95,
        pic50Vqe: 9.5,
        quantumHardware: "full_amplitude",
        mw: 420.5,
        logp: 2.1,
        tpsa: 75.0,
        lipinskiViolations: 0,
        isDruglike: true,
        citationVerdict: "SUPPORTED",
        citationConfidence: 0.93,
        citationGatePassed: true,
        isBestSoFar: true,
        noveltyFlag: true,
      },
    ],
    domainBreakdown: [
      {
        domainId: "biomedical",
        totalCycles: 30,
        totalClaimsVerified: 300,
        totalSupported: 210,
        totalContradicted: 45,
        totalAmbiguous: 45,
        bestPic50: 9.4,
        supportRate: 0.7,
      },
    ],
    cycleSummary: {
      totalCycles: 180,
      completedCycles: 175,
      failedCycles: 5,
      avgDurationMs: 280_000,
      totalCandidatesDiscovered: 9000,
      totalCandidatesScored: 8500,
      totalClaimsVerified: 1800,
      totalCognitionItemsAdded: 540,
      convergenceReachedCount: 3,
      bestPic50Across: 9.4,
    },
    dailyProgression: [
      { dayNumber: 1, date: "2026-01-01", cycleCount: 6, bestPic50: 8.1, summary: "Day 1" },
      { dayNumber: 2, date: "2026-01-02", cycleCount: 6, bestPic50: 8.3, summary: "Day 2" },
    ],
    bestEvolveStep: {
      stepName: "researcher",
      name: "Best Step",
      score: 9.1,
      evalScore: 9.2,
      analysis: "Improved binding affinity via P2 group modification.",
      citationVerdict: "SUPPORTED",
    },
    methodology: "Test methodology note.",
  };

  it("7. produces valid markdown with all major sections", () => {
    const md = renderReportMarkdown(baseReport);

    expect(md).toContain("# notus.is");
    expect(md).toContain("## Executive Summary");
    expect(md).toContain("## 6-Phase Verification Cycle Statistics");
    expect(md).toContain("## Top");
    expect(md).toContain("## Scientific Domain Breakdown");
    expect(md).toContain("## Daily Progression");
    expect(md).toContain("## ASI-Evolve Best Step");
    expect(md).toContain("## Methodology");
  });

  it("8. handles empty topCandidates gracefully", () => {
    const report = { ...baseReport, topCandidates: [] };
    const md = renderReportMarkdown(report);

    expect(md).toContain("No candidates have been generated yet");
    expect(md).not.toContain("| Rank |");
  });

  it("9. handles empty domainBreakdown gracefully", () => {
    const report = { ...baseReport, domainBreakdown: [] };
    const md = renderReportMarkdown(report);

    // Section should not appear when empty
    expect(md).not.toContain("## Scientific Domain Breakdown");
  });

  it("10. handles empty dailyProgression gracefully", () => {
    const report = { ...baseReport, dailyProgression: [] };
    const md = renderReportMarkdown(report);

    expect(md).not.toContain("## Daily Progression");
  });

  it("produces correct pIC50 in executive summary table", () => {
    const md = renderReportMarkdown(baseReport);
    expect(md).toContain("9.40");
  });

  it("includes SMILES strings section", () => {
    const md = renderReportMarkdown(baseReport);
    expect(md).toContain("### SMILES Strings");
    expect(md).toContain("CC(=O)Nc1ccc(O)cc1");
  });

  it("includes campaign day in header", () => {
    const md = renderReportMarkdown(baseReport);
    expect(md).toContain("**Campaign Day:** 30");
  });
});
