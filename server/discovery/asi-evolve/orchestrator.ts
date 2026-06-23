/**
 * ASI-Evolve Orchestrator — TypeScript port of pipeline/main.py
 * Implements the full 5-agent autonomous improvement loop:
 *   1. Learn    — seed/refresh cognition store from 10 public databases
 *   2. Design   — Researcher generates a strategy (full or diff mode)
 *   3. Experiment — Engineer executes the strategy
 *   4. Analyze  — Analyzer extracts lessons and updates cognition store
 *   5. Manage   — Manager auto-tunes Researcher/Analyzer prompts (every N steps)
 *
 * Memory systems:
 *   - Cognition Store: semantic memory with embedding-based retrieval
 *   - Experiment Database: UCB1/Island/Greedy/Random sampling
 *
 * Run State Persistence (run_state.py equivalent):
 *   - managedPrompts, islandSamplerState, bestScore are loaded from DB on first call
 *   - Saved back to DB after each step so restarts resume from the correct state
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

import { seedCognitionStore, refreshCognitionStore, seedFromPythonDiscovery } from "./cognition-seeder";
import { evolveDiscoveryQuery } from "../query-evolver";
import { sampleNodes, recordNode, getBestNode, getOrCreateRun, getRunStats } from "./database";
import { IslandSampler } from "./island-sampler";
import { generateStrategy } from "./researcher";
import { executeStrategy } from "./engineer";
import { analyzeNode, extractAndStoreCognition } from "./analyzer";
import { runManager, initManagedPrompts, type ManagedPrompts } from "./manager";
import { BestSnapshotManager } from "./best-snapshot";
import {
  saveRunState,
  loadRunState,
  defaultRunState,
  type IslandSamplerState,
} from "./run-state";
import { notifyOwner } from "../_core_shim";
import type { EvolveNode, SampledContext } from "./types";

// ─── Run Configuration ────────────────────────────────────────────────────────

const RUN_NAME = "hiv-protease-run-1";
const COGNITION_REFRESH_EVERY = 10;  // refresh public DB every N steps
const MANAGER_RUN_EVERY = 5;         // Manager auto-tunes prompts every N steps
const USE_DIFF_MODE_AFTER = 3;       // Use researcher_diff after N steps (once we have a base)
const SAMPLING_ALGORITHM: "ucb1" | "island" | "greedy" | "random" = "ucb1";

// ─── Module-level state (persists across Heartbeat calls in the same process) ─
// These are initialized from DB on the first runEvolveStep() call.

let managedPrompts: ManagedPrompts = initManagedPrompts();
let islandSampler: IslandSampler | null = null;
let bestSnapshotManager: BestSnapshotManager | null = null;
let stateLoaded = false;  // tracks whether we've loaded persisted state from DB

// ─── State Initialization ─────────────────────────────────────────────────────

/**
 * Load persisted run state from the database.
 * Called once on the first runEvolveStep() invocation.
 * Mirrors run_state.py load() from the Python source.
 */
async function ensureStateLoaded(runId: number): Promise<void> {
  if (stateLoaded) return;

  const state = await loadRunState(runId);
  if (state) {
    // Restore Manager-tuned prompts
    managedPrompts = state.managedPrompts;

    // Restore IslandSampler rotation state
    if (SAMPLING_ALGORITHM === "island" && state.islandSamplerState) {
      islandSampler = new IslandSampler();
      restoreIslandSamplerState(islandSampler, state.islandSamplerState);
    }

    // Restore BestSnapshotManager with persisted best score
    bestSnapshotManager = new BestSnapshotManager(runId);
    await bestSnapshotManager.initFromBestScore(state.bestScore);

    console.log(
      `[ASI-Evolve] Resumed from persisted state: ` +
      `promptVersion=${managedPrompts.stepCount}, ` +
      `bestScore=${state.bestScore.toFixed(3)}`
    );
  } else {
    // First run — use defaults
    bestSnapshotManager = new BestSnapshotManager(runId);
    console.log(`[ASI-Evolve] No persisted state found — starting fresh`);
  }

  stateLoaded = true;
}

/**
 * Extract serializable state from an IslandSampler instance.
 */
function extractIslandSamplerState(sampler: IslandSampler): IslandSamplerState {
  return sampler.getSerializableState();
}

/**
 * Restore IslandSampler rotation state from a serialized snapshot.
 */
function restoreIslandSamplerState(
  sampler: IslandSampler,
  state: IslandSamplerState
): void {
  sampler.restoreState(state);
}

// ─── Main Loop Step ───────────────────────────────────────────────────────────

/**
 * Run one full ASI-Evolve step.
 * This is the unit called by the Heartbeat scheduler every 4 hours.
 */
export async function runEvolveStep(): Promise<{
  step_name: string;
  score: number;
  best_pic50: number;
  is_new_best: boolean;
  cognition_added: number;
  elapsed_ms: number;
  sampling_algorithm: string;
  used_diff_mode: boolean;
  manager_ran: boolean;
  evolved_query: string | null;
}> {
  const startTime = Date.now();
  const runId = await getOrCreateRun(RUN_NAME);
  const stats = await getRunStats(runId);
  const stepNum = stats.step_count + 1;
  const stepName = `step_${String(stepNum).padStart(4, "0")}`;

  // Load persisted state on first call (run_state.py equivalent)
  await ensureStateLoaded(runId);

  console.log(`[ASI-Evolve] Starting ${stepName} (run_id=${runId}, algorithm=${SAMPLING_ALGORITHM})`);

  // ── Phase 1: Learn ────────────────────────────────────────────────────────
  let cognitionAdded = 0;
  if (stepNum === 1) {
    const seedResult = await seedCognitionStore(runId);
    cognitionAdded = seedResult.added;
    console.log(`[ASI-Evolve] Cognition seeded: ${cognitionAdded} items from 10 sources`);
    // Python discovery engine: seed from 60 additional sources on first step
    const pythonAdded = await seedFromPythonDiscovery(runId);
    if (pythonAdded > 0) {
      cognitionAdded += pythonAdded;
      console.log(`[ASI-Evolve] Python discovery: +${pythonAdded} items (total: ${cognitionAdded})`);
    }
  } else if (stepNum % COGNITION_REFRESH_EVERY === 0) {
    cognitionAdded = await refreshCognitionStore(runId);
    console.log(`[ASI-Evolve] Cognition refreshed: +${cognitionAdded} items`);
    // Python discovery engine: incremental refresh every COGNITION_REFRESH_EVERY steps
    const pythonAdded = await seedFromPythonDiscovery(
      runId,
      "HIV protease inhibitor novel scaffold binding affinity",
      20,
    );
    if (pythonAdded > 0) {
      cognitionAdded += pythonAdded;
      console.log(`[ASI-Evolve] Python discovery refresh: +${pythonAdded} items`);
    }
  }

  // ── Phase 2: Design ───────────────────────────────────────────────────────
  // Sample context nodes using the configured algorithm
  let sampledNodes: EvolveNode[];
  let samplingAlgorithmUsed = SAMPLING_ALGORITHM;

  if (SAMPLING_ALGORITHM === "island") {
    // Island sampling: MAP-Elites with feature dimensions
    if (!islandSampler) {
      islandSampler = new IslandSampler();
    }
    const allNodes = await sampleNodes(runId, 20, "random", 1.414);
    sampledNodes = islandSampler.sample(allNodes, 3);
    samplingAlgorithmUsed = "island";
  } else {
    sampledNodes = await sampleNodes(runId, 3, SAMPLING_ALGORITHM, 1.414);
  }

  const bestNode = await getBestNode(runId);

  const context: SampledContext = {
    nodes: sampledNodes,
    best_node: bestNode,
    cognition_items: [],
  };

  // Decide whether to use diff mode (researcher_diff)
  // After USE_DIFF_MODE_AFTER steps and when we have a best node with code
  const useDiffMode = stepNum > USE_DIFF_MODE_AFTER && bestNode?.code && bestNode.code.trim().length > 0;

  console.log(`[ASI-Evolve] Designing strategy (${sampledNodes.length} context nodes, diffMode=${useDiffMode})...`);
  const strategy = await generateStrategy(runId, context, stepName, {
    baseCode: useDiffMode ? bestNode!.code : undefined,
    systemPrompt: managedPrompts.researcherSystemPrompt,
  });
  console.log(`[ASI-Evolve] Strategy: "${strategy.name}"`);

  // ── Phase 3: Experiment ───────────────────────────────────────────────────
  console.log(`[ASI-Evolve] Executing strategy...`);
  const results = await executeStrategy(strategy, stepName, 50);
  console.log(
    `[ASI-Evolve] Results: score=${results.eval_score.toFixed(3)}, ` +
    `best_pic50=${results.best_pic50.toFixed(2)}, ` +
    `verified=${results.top10_verified_count}/10, ` +
    `admet=${(results.admet_pass_rate * 100).toFixed(0)}%`
  );

  // ── Phase 4: Analyze ──────────────────────────────────────────────────────
  const parentIds = sampledNodes.map((n) => n.id!).filter(Boolean);
  const score = results.eval_score;

  const nodeData: Omit<EvolveNode, "id"> = {
    run_id: runId,
    step_name: stepName,
    name: strategy.name,
    motivation: strategy.motivation,
    code: strategy.code_template,
    results,
    analysis: "",
    score,
    eval_score: results.eval_score,
    success: results.success,
    parent_ids: parentIds,
    visit_count: 0,
    is_best: false,
    created_at: Date.now(),
    metadata: {
      approach: strategy.approach,
      expected_improvement: strategy.expected_improvement,
      used_diff_mode: useDiffMode,
      sampling_algorithm: samplingAlgorithmUsed,
    },
  };

  const savedNode = await recordNode(nodeData);

  // Generate analysis using LLM with Manager-tuned prompt
  const analysis = await analyzeNode(savedNode, bestNode, managedPrompts.analyzerSystemPrompt);
  savedNode.analysis = analysis;

  // Update analysis in DB
  try {
    const mysqlMod = await import("mysql2/promise");
    const conn = await mysqlMod.createConnection(process.env.DATABASE_URL!);
    await conn.execute(
      `UPDATE evolve_nodes SET analysis = ? WHERE id = ?`,
      [analysis, savedNode.id ?? 0]
    );
    await conn.end();
  } catch (e) {
    console.warn("[ASI-Evolve] Failed to update analysis:", e);
  }

  // Extract and store new cognition items from this step
  const newCognitionItems = await extractAndStoreCognition(runId, savedNode);
  cognitionAdded += newCognitionItems;

  // ── citation.manus.space: verify the best candidate from this step ────────────
  // Build a verifiable claim for the top candidate and submit to ttruthdesk.
  // The verdict is stored in the node metadata and used to boost/penalise eval_score.
  if (results.best_pic50 > 6.0 && results.top_candidates && results.top_candidates.length > 0) {
    try {
      const { verifyClaim: citVerify, buildCandidateClaim: buildClaim, verdictScoreModifier } =
        await import("./citation-client");
      const topCandidate = results.top_candidates[0];
      const claimText = buildClaim({
        name: topCandidate.smiles?.slice(0, 30) ?? stepName,
        smiles: topCandidate.smiles ?? "",
        pic50: results.best_pic50,
        track: topCandidate.track ?? "unknown",
        verificationSource: "HIV-1 protease (UniProt P04585)",
      });
      const citResult = await citVerify(claimText, "structural_biology");
      if (citResult) {
        // Persist verdict in node metadata
        savedNode.metadata = {
          ...savedNode.metadata,
          citationVerdict: citResult.verdict,
          citationConfidence: citResult.confidenceScore,
          citationEvidenceUrl: citResult.evidenceSource,
        };
        // Apply score modifier to eval_score
        const modifier = verdictScoreModifier(citResult.verdict);
        if (modifier !== 0) {
          savedNode.eval_score = Math.max(0, savedNode.eval_score + modifier);
          savedNode.score = savedNode.eval_score;
        }
        // Persist updated metadata and score to DB
        try {
          const mysqlMod2 = await import("mysql2/promise");
          const conn2 = await mysqlMod2.createConnection(process.env.DATABASE_URL!);
          await conn2.execute(
            `UPDATE evolve_nodes SET
              metadata = JSON_SET(COALESCE(metadata, '{}'), '$.citationVerdict', ?, '$.citationConfidence', ?, '$.citationEvidenceUrl', ?),
              citation_verdict = ?,
              citation_confidence = ?,
              score = ?,
              eval_score = ?
            WHERE id = ?`,
            [citResult.verdict, citResult.confidenceScore, citResult.evidenceSource,
             citResult.verdict, citResult.confidenceScore,
             savedNode.score, savedNode.eval_score, savedNode.id ?? 0]
          );
          await conn2.end();
        } catch { /* non-fatal */ }
        console.log(`[ASI-Evolve] citation.manus.space: ${citResult.verdict} (confidence=${citResult.confidenceScore.toFixed(2)}, modifier=${modifier >= 0 ? '+' : ''}${modifier})`);
      }
    } catch (e) {
      console.warn("[ASI-Evolve] citation.manus.space verification failed:", (e as Error).message);
    }
  }

  // Check if this is a new global best
  const isNewBest = score > (bestNode?.score || 0);

  // Save best snapshot
  if (bestSnapshotManager) {
    try {
      const wasNewBest = await bestSnapshotManager.updateIfBetter(savedNode, stepName);
      if (wasNewBest) {
        console.log(`[ASI-Evolve] New best snapshot saved: ${strategy.name} (score=${score.toFixed(3)})`);
      }
    } catch (e) {
      console.warn("[ASI-Evolve] Failed to save best snapshot:", e);
    }
  }

  // ── Phase 5: Manage ───────────────────────────────────────────────────────
  // Manager auto-tunes Researcher/Analyzer prompts every MANAGER_RUN_EVERY steps
  // ── Query Evolution ──────────────────────────────────────────────────────
  // After each step, evolve the discovery query using Analyzer lessons and
  // citation verdicts from the node metadata.  The evolved query is persisted
  // in the node metadata and will be used by the next Heartbeat cycle's
  // python-bridge call via seedFromPythonDiscovery().
  let evolvedQuery: string | null = null;
  try {
    // Collect lessons: node analysis + top-3 previous node analyses
    const lessons: string[] = [];
    if (savedNode.analysis) lessons.push(savedNode.analysis);
    const recentForLessons = await sampleNodes(runId, 3, "greedy", 1.0);
    for (const n of recentForLessons) {
      if (n.analysis && n.id !== savedNode.id) lessons.push(n.analysis);
    }

    // Collect citation verdicts from node metadata
    const supportedClaims: string[] = [];
    const contradictedClaims: string[] = [];
    const allNodes = await sampleNodes(runId, 10, "random", 1.0);
    for (const n of allNodes) {
      const verdict = (n.metadata as any)?.citationVerdict as string | undefined;
      const claim = `${n.name}: pIC50=${n.results?.best_pic50?.toFixed(2) ?? "N/A"}, strategy: ${n.motivation?.slice(0, 120) ?? ""}`;
      if (verdict === "Supported" || verdict === "Partially Supported") {
        supportedClaims.push(claim);
      } else if (verdict === "Contradicted") {
        contradictedClaims.push(claim);
      }
    }

    const previousQuery = (savedNode.metadata as any)?.lastDiscoveryQuery as string
      ?? "HIV-1 protease inhibitor small molecule binding affinity pIC50 scaffold design";

    const evolved = await evolveDiscoveryQuery(
      previousQuery,
      lessons,
      supportedClaims,
      contradictedClaims
    );
    evolvedQuery = evolved.query;

    // Persist the evolved query in node metadata for traceability
    savedNode.metadata = {
      ...savedNode.metadata,
      evolvedQuery: evolved.query,
      evolvedQueryRationale: evolved.rationale,
      evolvedQueryLlm: evolved.llmGenerated,
      evolvedQueryAt: evolved.generatedAt,
    };
    try {
      const mysqlEQ = await import("mysql2/promise");
      const connEQ = await mysqlEQ.createConnection(process.env.DATABASE_URL!);
      await connEQ.execute(
        `UPDATE evolve_nodes SET metadata = JSON_SET(COALESCE(metadata, '{}'),
          '$.evolvedQuery', ?,
          '$.evolvedQueryRationale', ?,
          '$.evolvedQueryLlm', ?,
          '$.evolvedQueryAt', ?
        ) WHERE id = ?`,
        [evolved.query, evolved.rationale, evolved.llmGenerated ? 1 : 0, evolved.generatedAt, savedNode.id ?? 0]
      );
      await connEQ.end();
    } catch { /* non-fatal */ }
    console.log(`[ASI-Evolve] Query evolved (llm=${evolved.llmGenerated}): "${evolved.query.slice(0, 80)}..."`);
  } catch (e) {
    console.warn("[ASI-Evolve] evolveDiscoveryQuery failed:", (e as Error).message);
  }

  let managerRan = false;
  if (stepNum % MANAGER_RUN_EVERY === 0) {
    console.log(`[ASI-Evolve] Running Manager at step ${stepNum}...`);
    try {
      const recentNodes = await sampleNodes(runId, 10, "random", 1.414);
      managedPrompts = await runManager(
        "Discover potent HIV-1 protease inhibitors with pIC50 ≥ 9.0 (≤ 1 nM IC50) and good ADMET properties",
        recentNodes,
        managedPrompts,
        stepNum
      );
      managerRan = true;
      console.log(`[ASI-Evolve] Manager updated prompts (researcher=${managedPrompts.researcherSystemPrompt.length}chars, analyzer=${managedPrompts.analyzerSystemPrompt.length}chars)`);
    } catch (e) {
      console.warn("[ASI-Evolve] Manager failed:", e);
    }
  }

  // ── Persist Run State ─────────────────────────────────────────────────────
  // Save managedPrompts, islandSampler state, and bestScore after every step.
  // This is the run_state.py equivalent — ensures resumability after restarts.
  try {
    const islandState = islandSampler ? extractIslandSamplerState(islandSampler) : null;
    const currentBestScore = bestSnapshotManager?.getBestScore() ?? score;
    await saveRunState(runId, managedPrompts, islandState, currentBestScore);
  } catch (e) {
    console.warn("[ASI-Evolve] Failed to persist run state:", e);
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[ASI-Evolve] ${stepName} complete in ${elapsed}ms. ` +
    `Score=${score.toFixed(3)}, NewBest=${isNewBest}, ` +
    `CognitionAdded=${cognitionAdded}, ManagerRan=${managerRan}`
  );

  // Notify owner on new best or every 6 steps (daily)
  if (isNewBest && results.best_pic50 > 7.0) {
    try {
      await notifyOwner({
        title: `New Best: pIC50=${results.best_pic50.toFixed(2)} (${strategy.name})`,
        content: [
          `ASI-Evolve ${stepName}: New global best`,
          `pIC50=${results.best_pic50.toFixed(2)}, Score=${score.toFixed(3)}`,
          `Strategy: ${strategy.name}`,
          `Verified: ${results.top10_verified_count}/10`,
          `ADMET pass: ${(results.admet_pass_rate * 100).toFixed(0)}%`,
          `SMILES: ${results.best_smiles}`,
        ].join("\n"),
      });
    } catch { /* non-fatal */ }
  } else if (stepNum % 6 === 0) {
    try {
      const currentStats = await getRunStats(runId);
      await notifyOwner({
        title: `ASI-Evolve Daily Summary — Step ${stepNum}`,
        content: [
          `Steps: ${currentStats.step_count}`,
          `Best score: ${currentStats.best_score.toFixed(3)}`,
          `Success rate: ${(currentStats.success_rate * 100).toFixed(0)}%`,
          `Mean score: ${currentStats.mean_score.toFixed(3)}`,
          `Cognition items added: ${cognitionAdded}`,
          `Sampling: ${samplingAlgorithmUsed}`,
          `Manager ran: ${managerRan}`,
        ].join("\n"),
      });
    } catch { /* non-fatal */ }
  }

  return {
    step_name: stepName,
    score,
    best_pic50: results.best_pic50,
    is_new_best: isNewBest,
    cognition_added: cognitionAdded,
    elapsed_ms: elapsed,
    sampling_algorithm: samplingAlgorithmUsed,
    used_diff_mode: typeof useDiffMode === 'boolean' ? useDiffMode : false,
    manager_ran: managerRan,
    evolved_query: evolvedQuery,
  };
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Get the current state of the ASI-Evolve run for the dashboard.
 */
export async function getEvolveStatus(): Promise<{
  run_id: number;
  step_count: number;
  best_score: number;
  best_pic50: number;
  best_smiles: string;
  success_rate: number;
  mean_score: number;
  cognition_count: number;
  status: string;
  sampling_algorithm: string;
  manager_prompt_version: number;
}> {
  try {
    const runId = await getOrCreateRun(RUN_NAME);
    const stats = await getRunStats(runId);
    const bestNode = await getBestNode(runId);
    const { getCognitionCount } = await import("./cognition");
    const cognitionCount = await getCognitionCount(runId);

    return {
      run_id: runId,
      step_count: stats.step_count,
      best_score: stats.best_score,
      best_pic50: bestNode?.results?.best_pic50 || 0,
      best_smiles: bestNode?.results?.best_smiles || "",
      success_rate: stats.success_rate,
      mean_score: stats.mean_score,
      cognition_count: cognitionCount,
      status: "running",
      sampling_algorithm: SAMPLING_ALGORITHM,
      manager_prompt_version: managedPrompts.stepCount,
    };
  } catch (e) {
    console.error("[ASI-Evolve] getEvolveStatus failed:", e);
    return {
      run_id: 0,
      step_count: 0,
      best_score: 0,
      best_pic50: 0,
      best_smiles: "",
      success_rate: 0,
      mean_score: 0,
      cognition_count: 0,
      status: "error",
      sampling_algorithm: SAMPLING_ALGORITHM,
      manager_prompt_version: 0,
    };
  }
}
