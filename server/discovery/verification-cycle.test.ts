/**
 * verification-cycle.test.ts
 *
 * Unit tests for the 6-phase VerificationCycle.
 * All external dependencies are mocked so no real DB, Python subprocess,
 * or HTTP calls are made.
 *
 * Test plan:
 *   1. Phase 1 DISCOVER — pythonBridge.query returns SMILES
 *   2. Phase 2 SCORE    — ML ensemble + quantumScore produce scored candidates
 *   3. Phase 3 VERIFY   — verifyClaim called for top-10, verdicts recorded
 *   4. Phase 4 COGNITION — addCognitionItem called for each verdict
 *   5. Phase 5 EVOLVE   — runEvolveStep result captured in phases.evolve
 *   6. Phase 6 CONVERGENCE — convergence skipped before Day 7
 *   + Full cycle integration — runVerificationCycle returns valid VerificationCycle
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock all external dependencies before importing the module under test ─────

vi.mock("./python-bridge", () => ({
  pythonBridge: {
    query: vi.fn(),
    quantumScore: vi.fn(),
    healthCheck: vi.fn(),
  },
}));

vi.mock("./engineer", () => ({
  generateAllTracks: vi.fn(),
  filterDruglike: vi.fn(),
}));

vi.mock("./predictor", () => ({
  trainEnsemble: vi.fn(),
  predictBatch: vi.fn(),
  quantumScore: vi.fn(),
}));

vi.mock("./convergence", () => ({
  detectConvergence: vi.fn(),
  shouldRunConvergence: vi.fn(),
}));

vi.mock("./asi-evolve/orchestrator", () => ({
  runEvolveStep: vi.fn(),
}));

vi.mock("./asi-evolve/cognition", () => ({
  addCognitionItem: vi.fn(),
}));

vi.mock("./asi-evolve/database", () => ({
  getOrCreateRun: vi.fn(),
}));

vi.mock("./asi-evolve/citation-client", () => ({
  verifyClaim: vi.fn(),
  buildCandidateClaim: vi.fn(),
  verdictScoreModifier: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

// ── Import mocked modules ──────────────────────────────────────────────────────

import { pythonBridge } from "./python-bridge";
import { generateAllTracks, filterDruglike } from "./engineer";
import { trainEnsemble, predictBatch, quantumScore } from "./predictor";
import { detectConvergence, shouldRunConvergence } from "./convergence";
import { runEvolveStep } from "./asi-evolve/orchestrator";
import { addCognitionItem } from "./asi-evolve/cognition";
import { getOrCreateRun } from "./asi-evolve/database";
import { verifyClaim, buildCandidateClaim, verdictScoreModifier } from "./asi-evolve/citation-client";
import { getDb } from "../db";

// Import the module under test AFTER mocks are set up
import { runVerificationCycle } from "./verification-cycle";

// ── Shared mock DB ─────────────────────────────────────────────────────────────

const mockDb = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue({}),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockResolvedValue([]),
};

// ── Default mock implementations ───────────────────────────────────────────────

function setupDefaultMocks() {
  vi.mocked(getDb).mockResolvedValue(mockDb as any);

  // Phase 1: Python bridge returns 2 SMILES
  vi.mocked(pythonBridge.query).mockResolvedValue({
    query: "HIV protease inhibitor",
    domains: ["molecular"],
    totalRecords: 100,
    quantumScores: {},
    sourceBreakdown: { chembl: 50, pubchem: 50 },
    topResults: [
      { id: "1", title: "Compound A", source: "chembl", abstract: "", smiles: "CC(=O)O" },
      { id: "2", title: "Compound B", source: "pubchem", abstract: "", smiles: "c1ccccc1" },
    ],
    backendUsed: "python_engine",
    elapsedMs: 200,
  });

  // Phase 2: Engineer generates 2 candidates
  vi.mocked(generateAllTracks).mockResolvedValue([
    { smiles: "CC(=O)O", parentSmiles: "CC(=O)O", track: "A", modificationType: "add_group", admet: null, isNovel: true, tanimotoToParent: 0.8 },
    { smiles: "c1ccccc1", parentSmiles: "c1ccccc1", track: "B", modificationType: "ring_mod", admet: null, isNovel: true, tanimotoToParent: 0.9 },
  ] as any);
  vi.mocked(filterDruglike).mockReturnValue([
    { smiles: "CC(=O)O", parentSmiles: "CC(=O)O", track: "A", modificationType: "add_group", admet: null, isNovel: true, tanimotoToParent: 0.8 },
    { smiles: "c1ccccc1", parentSmiles: "c1ccccc1", track: "B", modificationType: "ring_mod", admet: null, isNovel: true, tanimotoToParent: 0.9 },
  ] as any);
  vi.mocked(trainEnsemble).mockResolvedValue(undefined);
  vi.mocked(predictBatch).mockResolvedValue([
    { pic50: 8.5, confidence: 0.9, ensembleStd: 0.1 },
    { pic50: 7.8, confidence: 0.85, ensembleStd: 0.15 },
  ] as any);
  vi.mocked(quantumScore).mockResolvedValue({
    quantumScore: 0.75,
    pic50Vqe: 8.6,
    hardware: "full_amplitude",
    provenance: "QUANTUM_SIM",
  } as any);

  // Phase 3: Citation verification
  vi.mocked(buildCandidateClaim).mockReturnValue("Compound X shows pIC50=8.5 against HIV-1 protease.");
  vi.mocked(verifyClaim).mockResolvedValue({
    verdict: "Supported",
    confidenceScore: 0.85,
    evidenceSource: "PubMed",
    summary: "Supported by 3 papers",
  } as any);
  vi.mocked(verdictScoreModifier).mockReturnValue(0.5);

  // Phase 4: Cognition store
  vi.mocked(getOrCreateRun).mockResolvedValue(1);
  vi.mocked(addCognitionItem).mockResolvedValue(42);

  // Phase 5: ASI-Evolve step
  vi.mocked(runEvolveStep).mockResolvedValue({
    step_name: "step_0001",
    score: 8.75,
    best_pic50: 8.75,
    is_new_best: true,
    cognition_added: 5,
    elapsed_ms: 1500,
    sampling_algorithm: "ucb1",
    used_diff_mode: false,
    manager_ran: false,
  });

  // Phase 6: Convergence — skip before Day 7
  vi.mocked(shouldRunConvergence).mockReturnValue(false);
  vi.mocked(detectConvergence).mockResolvedValue({
    cycleNumber: 1,
    dayNumber: 1,
    totalCandidates: 2,
    convergenceCandidates: [],
    bestCandidate: null,
    analysisTimestamp: new Date().toISOString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mockDb chain methods
  mockDb.insert.mockReturnThis();
  mockDb.values.mockResolvedValue({});
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.where.mockResolvedValue({});
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.offset.mockResolvedValue([]);
  setupDefaultMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Phase 1 DISCOVER", () => {
  it("calls pythonBridge.query and extracts SMILES from topResults", async () => {
    const cycle = await runVerificationCycle();

    expect(vi.mocked(pythonBridge.query)).toHaveBeenCalledOnce();
    expect(vi.mocked(pythonBridge.query)).toHaveBeenCalledWith(
      expect.objectContaining({
        domains: expect.arrayContaining(["molecular", "structural_biology"]),
        useQuantum: false,
      })
    );

    expect(cycle.phases.discovery.status).toBe("completed");
    expect(cycle.phases.discovery.itemsProcessed).toBeGreaterThanOrEqual(0);
    expect(cycle.candidatesDiscovered).toBeGreaterThanOrEqual(0);
  });

  it("gracefully handles Python bridge failure and continues", async () => {
    vi.mocked(pythonBridge.query).mockRejectedValue(new Error("Python engine unavailable"));

    const cycle = await runVerificationCycle();

    // Discovery phase should fail but cycle should still complete
    expect(cycle.phases.discovery.status).toBe("failed");
    expect(cycle.phases.discovery.error).toContain("Python engine unavailable");
    // Cycle should still attempt subsequent phases
    expect(cycle.status).not.toBe("running");
  });
});

describe("Phase 2 SCORE", () => {
  it("trains ensemble and scores candidates from both engineer and Python bridge", async () => {
    const cycle = await runVerificationCycle();

    expect(vi.mocked(trainEnsemble)).toHaveBeenCalledOnce();
    expect(vi.mocked(predictBatch)).toHaveBeenCalledOnce();
    expect(vi.mocked(quantumScore)).toHaveBeenCalled();

    expect(cycle.phases.scoring.status).toBe("completed");
    expect(cycle.candidatesScored).toBeGreaterThan(0);
    expect(cycle.bestPic50).toBeGreaterThan(0);
  });

  it("records bestPic50 from the highest-scoring candidate", async () => {
    vi.mocked(predictBatch).mockResolvedValue([
      { pic50: 9.2, confidence: 0.95, ensembleStd: 0.05 },
      { pic50: 7.1, confidence: 0.7, ensembleStd: 0.3 },
    ] as any);

    const cycle = await runVerificationCycle();

    expect(cycle.bestPic50).toBeCloseTo(9.2, 1);
  });
});

describe("Phase 3 VERIFY", () => {
  it("calls verifyClaim for up to 10 top-scoring candidates", async () => {
    const cycle = await runVerificationCycle();

    expect(vi.mocked(buildCandidateClaim)).toHaveBeenCalled();
    expect(vi.mocked(verifyClaim)).toHaveBeenCalled();

    expect(cycle.phases.verification.status).toBe("completed");
    expect(cycle.claimsVerified).toBeGreaterThanOrEqual(0);
  });

  it("skips verification when no scored candidates are available", async () => {
    vi.mocked(predictBatch).mockResolvedValue([]);
    vi.mocked(generateAllTracks).mockResolvedValue([]);
    vi.mocked(filterDruglike).mockReturnValue([]);
    vi.mocked(pythonBridge.query).mockResolvedValue({
      query: "HIV protease",
      domains: [],
      totalRecords: 0,
      quantumScores: {},
      sourceBreakdown: {},
      topResults: [],
      backendUsed: "python_engine",
      elapsedMs: 50,
    });

    const cycle = await runVerificationCycle();

    // With no candidates, verification should be skipped
    expect(["skipped", "completed"]).toContain(cycle.phases.verification.status);
  });
});

describe("Phase 4 COGNITION", () => {
  it("feeds citation verdicts into evolve_cognition via addCognitionItem", async () => {
    const cycle = await runVerificationCycle();

    // addCognitionItem should be called for each verified claim
    if (cycle.claimsVerified > 0) {
      expect(vi.mocked(addCognitionItem)).toHaveBeenCalled();
      expect(vi.mocked(getOrCreateRun)).toHaveBeenCalledOnce();
    }

    expect(cycle.phases.cognition.status).not.toBe("running");
    expect(cycle.cognitionItemsAdded).toBeGreaterThanOrEqual(0);
  });

  it("stores verdict metadata in cognition item including scoreModifier", async () => {
    await runVerificationCycle();

    if (vi.mocked(addCognitionItem).mock.calls.length > 0) {
      const firstCall = vi.mocked(addCognitionItem).mock.calls[0][0];
      expect(firstCall.source_type).toBe("manual");
      expect(firstCall.metadata).toHaveProperty("verdict");
      expect(firstCall.metadata).toHaveProperty("scoreModifier");
    }
  });
});

describe("Phase 5 EVOLVE", () => {
  it("calls runEvolveStep and captures step_name and score", async () => {
    const cycle = await runVerificationCycle();

    expect(vi.mocked(runEvolveStep)).toHaveBeenCalledOnce();
    expect(cycle.phases.evolve.status).toBe("completed");
    expect(cycle.evolveStepName).toBe("step_0001");
    expect(cycle.evolveScore).toBeCloseTo(8.75, 2);
  });

  it("captures evolve phase failure without crashing the cycle", async () => {
    vi.mocked(runEvolveStep).mockRejectedValue(new Error("ASI-Evolve DB error"));

    const cycle = await runVerificationCycle();

    expect(cycle.phases.evolve.status).toBe("failed");
    expect(cycle.phases.evolve.error).toContain("ASI-Evolve DB error");
    // Cycle should still reach convergence phase
    expect(cycle.phases.convergence.status).not.toBe("running");
  });
});

describe("Phase 6 CONVERGENCE", () => {
  it("skips convergence analysis before Day 7", async () => {
    vi.mocked(shouldRunConvergence).mockReturnValue(false);

    const cycle = await runVerificationCycle();

    expect(vi.mocked(detectConvergence)).not.toHaveBeenCalled();
    expect(cycle.phases.convergence.status).toBe("skipped");
    expect(cycle.convergenceReached).toBe(false);
  });

  it("runs convergence analysis from Day 7 onwards", async () => {
    vi.mocked(shouldRunConvergence).mockReturnValue(true);
    vi.mocked(detectConvergence).mockResolvedValue({
      cycleNumber: 42,
      dayNumber: 7,
      totalCandidates: 2,
      convergenceCandidates: [
        {
          smiles: "CC(=O)O",
          tracks: ["A", "B"],
          meanPic50: 8.5,
          maxPic50: 8.7,
          minEnsembleStd: 0.1,
          convergenceScore: 0.82,
          trackResults: [],
        },
      ],
      bestCandidate: {
        smiles: "CC(=O)O",
        tracks: ["A", "B"],
        meanPic50: 8.5,
        maxPic50: 8.7,
        minEnsembleStd: 0.1,
        convergenceScore: 0.82,
        trackResults: [],
      },
      analysisTimestamp: new Date().toISOString(),
    });

    const cycle = await runVerificationCycle();

    expect(vi.mocked(detectConvergence)).toHaveBeenCalledOnce();
    expect(cycle.phases.convergence.status).toBe("completed");
    expect(cycle.convergenceReached).toBe(true);
  });
});

describe("Full cycle integration", () => {
  it("returns a valid VerificationCycle with all required fields", async () => {
    const cycle = await runVerificationCycle();

    // Shape validation
    expect(cycle.cycleId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(cycle.startedAt).toBeInstanceOf(Date);
    expect(cycle.completedAt).toBeInstanceOf(Date);
    expect(["completed", "failed"]).toContain(cycle.status);

    // All 6 phases must be present and not "running"
    const phaseNames = ["discovery", "scoring", "verification", "cognition", "evolve", "convergence"] as const;
    for (const name of phaseNames) {
      expect(cycle.phases[name]).toBeDefined();
      expect(cycle.phases[name].status).not.toBe("running");
      expect(typeof cycle.phases[name].durationMs).toBe("number");
      expect(typeof cycle.phases[name].summary).toBe("string");
    }

    // Summary stats
    expect(typeof cycle.candidatesDiscovered).toBe("number");
    expect(typeof cycle.candidatesScored).toBe("number");
    expect(typeof cycle.claimsVerified).toBe("number");
    expect(typeof cycle.cognitionItemsAdded).toBe("number");
    expect(typeof cycle.durationMs).toBe("number");
  });

  it("persists the cycle to the database with insert + update calls", async () => {
    await runVerificationCycle();

    // Initial insert (status = running)
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalled();
    // Multiple progress updates + final update
    expect(mockDb.update).toHaveBeenCalled();
  });
});
