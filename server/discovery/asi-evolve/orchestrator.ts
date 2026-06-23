/**
 * ASI-Evolve Orchestrator — TypeScript port of pipeline/main.py
 * Implements the 4-stage autonomous improvement loop:
 *   1. Learn  — seed/refresh cognition store from public databases
 *   2. Design — Researcher generates a strategy using UCB1-sampled context
 *   3. Experiment — Engineer executes the strategy
 *   4. Analyze — Analyzer extracts lessons and updates cognition store
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

import { seedCognitionStore, refreshCognitionStore } from "./cognition-seeder";
import { sampleNodes, recordNode, getBestNode, getOrCreateRun, getRunStats } from "./database";
import { generateStrategy } from "./researcher";
import { executeStrategy } from "./engineer";
import { analyzeNode, extractAndStoreCognition } from "./analyzer";
import { notifyOwner } from "../_core_shim";
import type { EvolveNode, SampledContext } from "./types";

const RUN_NAME = "hiv-protease-run-1";
const COGNITION_REFRESH_EVERY = 10; // refresh public DB every N steps

/**
 * Run one full ASI-Evolve step.
 * This is the unit called by the Heartbeat scheduler.
 */
export async function runEvolveStep(): Promise<{
  step_name: string;
  score: number;
  best_pic50: number;
  is_new_best: boolean;
  cognition_added: number;
  elapsed_ms: number;
}> {
  const startTime = Date.now();
  const runId = await getOrCreateRun(RUN_NAME);
  const stats = await getRunStats(runId);
  const stepNum = stats.step_count + 1;
  const stepName = `step_${String(stepNum).padStart(4, "0")}`;

  console.log(`[ASI-Evolve] Starting ${stepName} (run_id=${runId})`);

  // ── Phase 1: Learn ────────────────────────────────────────────────────────
  // Seed cognition store on first step, refresh every N steps
  let cognitionAdded = 0;
  if (stepNum === 1) {
    const seedResult = await seedCognitionStore(runId);
    cognitionAdded = seedResult.added;
    console.log(`[ASI-Evolve] Cognition seeded: ${cognitionAdded} items`);
  } else if (stepNum % COGNITION_REFRESH_EVERY === 0) {
    cognitionAdded = await refreshCognitionStore(runId);
    console.log(`[ASI-Evolve] Cognition refreshed: +${cognitionAdded} items`);
  }

  // ── Phase 2: Design ───────────────────────────────────────────────────────
  // Sample top-performing nodes using UCB1
  const sampledNodes = await sampleNodes(runId, 3, "ucb1", 1.414);
  const bestNode = await getBestNode(runId);

  const context: SampledContext = {
    nodes: sampledNodes,
    best_node: bestNode,
    cognition_items: [], // populated inside generateStrategy via retrieveCognition
  };

  console.log(`[ASI-Evolve] Designing strategy (${sampledNodes.length} context nodes)...`);
  const strategy = await generateStrategy(runId, context, stepName);
  console.log(`[ASI-Evolve] Strategy: "${strategy.name}"`);

  // ── Phase 3: Experiment ───────────────────────────────────────────────────
  console.log(`[ASI-Evolve] Executing strategy...`);
  const results = await executeStrategy(strategy, stepName, 50);
  console.log(`[ASI-Evolve] Results: score=${results.eval_score.toFixed(3)}, best_pic50=${results.best_pic50.toFixed(2)}, verified=${results.top10_verified_count}/10`);

  // ── Phase 4: Analyze ──────────────────────────────────────────────────────
  // Build the node record (without analysis yet)
  const parentIds = sampledNodes.map((n) => n.id!).filter(Boolean);
  const score = results.eval_score;

  const nodeData: Omit<EvolveNode, "id"> = {
    run_id: runId,
    step_name: stepName,
    name: strategy.name,
    motivation: strategy.motivation,
    code: strategy.code_template,
    results,
    analysis: "", // filled in below
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
    },
  };

  // Persist the node first (so it has an ID)
  const savedNode = await recordNode(nodeData);

  // Generate analysis using LLM
  const analysis = await analyzeNode(savedNode, bestNode);
  savedNode.analysis = analysis;

  // Update the analysis in the database
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

  // Check if this is a new global best
  const isNewBest = savedNode.is_best || score > (bestNode?.score || 0);
  const elapsed = Date.now() - startTime;

  console.log(`[ASI-Evolve] ${stepName} complete in ${elapsed}ms. Score=${score.toFixed(3)}, NewBest=${isNewBest}`);

  // Notify owner on new best or every 6 steps (daily)
  if (isNewBest && results.best_pic50 > 7.0) {
    try {
      await notifyOwner({
        title: `New Best: pIC50=${results.best_pic50.toFixed(2)} (${strategy.name})`,
        content: `ASI-Evolve ${stepName}: New global best pIC50=${results.best_pic50.toFixed(2)}\nStrategy: ${strategy.name}\nScore: ${score.toFixed(3)}\nVerified: ${results.top10_verified_count}/10\nSMILES: ${results.best_smiles}`,
      });
    } catch { /* non-fatal */ }
  } else if (stepNum % 6 === 0) {
    try {
      const currentStats = await getRunStats(runId);
      await notifyOwner({
        title: `ASI-Evolve Daily Summary — Step ${stepNum}`,
        content: `Steps: ${currentStats.step_count}\nBest score: ${currentStats.best_score.toFixed(3)}\nSuccess rate: ${(currentStats.success_rate * 100).toFixed(0)}%\nMean score: ${currentStats.mean_score.toFixed(3)}\nCognition items: ${cognitionAdded} added this step`,
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
  };
}

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
}> {
  try {
    const runId = await getOrCreateRun(RUN_NAME);
    const stats = await getRunStats(runId);
    const bestNode = await getBestNode(runId);

    // Get cognition count
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
    };
  }
}
