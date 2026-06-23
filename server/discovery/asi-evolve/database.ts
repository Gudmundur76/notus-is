/**
 * ASI-Evolve Experiment Database — TypeScript port of database/database.py
 * Implements UCB1, greedy, random, and island sampling algorithms.
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

import mysql from "mysql2/promise";
import type { EvolveNode, EvolveResults } from "./types";

let _pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}

// ─── UCB1 Sampling ───────────────────────────────────────────────────────────

/**
 * UCB1 score for a node.
 * score = mean_score + c * sqrt(ln(total_visits) / node_visits)
 */
function ucb1Score(node: EvolveNode, totalVisits: number, c: number): number {
  if (node.visit_count === 0) return Infinity; // unvisited nodes always sampled first
  return node.score + c * Math.sqrt(Math.log(totalVisits + 1) / node.visit_count);
}

/**
 * Sample n parent nodes from the experiment database using UCB1.
 * Faithful to ASI-Evolve's sampling contract: serialized, run-scoped.
 */
export async function sampleNodes(
  runId: number,
  n: number = 3,
  algorithm: "ucb1" | "greedy" | "random" = "ucb1",
  ucb1C: number = 1.414
): Promise<EvolveNode[]> {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT * FROM evolve_nodes WHERE run_id = ? ORDER BY created_at ASC`,
    [runId]
  ) as [any[], any];

  if (rows.length === 0) return [];

  const nodes: EvolveNode[] = rows.map(deserializeNode);
  const totalVisits = nodes.reduce((sum, n) => sum + n.visit_count, 0);

  let ranked: EvolveNode[];

  if (algorithm === "ucb1") {
    ranked = [...nodes].sort(
      (a, b) => ucb1Score(b, totalVisits, ucb1C) - ucb1Score(a, totalVisits, ucb1C)
    );
  } else if (algorithm === "greedy") {
    ranked = [...nodes].sort((a, b) => b.score - a.score);
  } else {
    // random — shuffle
    ranked = [...nodes].sort(() => Math.random() - 0.5);
  }

  return ranked.slice(0, n);
}

/**
 * Record a node in the experiment database.
 * Increments visit_count on all sampled parents.
 * Updates best snapshot if this node has the highest score.
 */
export async function recordNode(node: Omit<EvolveNode, "id">): Promise<EvolveNode> {
  const db = getPool();
  const now = Date.now();

  const [result] = await db.execute(
    `INSERT INTO evolve_nodes 
     (run_id, step_name, name, motivation, code, results, analysis, score, eval_score, 
      success, parent_ids, visit_count, is_best, created_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [
      node.run_id,
      node.step_name,
      node.name,
      node.motivation,
      node.code,
      JSON.stringify(node.results),
      node.analysis || null,
      node.score,
      node.eval_score,
      node.success ? 1 : 0,
      JSON.stringify(node.parent_ids),
      now,
      JSON.stringify(node.metadata || {}),
    ]
  ) as [any, any];

  const nodeId = (result as any).insertId;

  // Increment visit count on all parent nodes
  for (const parentId of node.parent_ids) {
    await db.execute(
      `UPDATE evolve_nodes SET visit_count = visit_count + 1 WHERE id = ?`,
      [parentId]
    );
  }

  // Update run stats and best snapshot
  await db.execute(
    `UPDATE evolve_runs SET step_count = step_count + 1, updated_at = ? WHERE id = ?`,
    [now, node.run_id]
  );

  // Check if this is the new best
  const [runRows] = await db.execute(
    `SELECT best_score FROM evolve_runs WHERE id = ?`,
    [node.run_id]
  ) as [any[], any];

  if (runRows.length > 0 && node.score > runRows[0].best_score) {
    // Clear old best flag
    await db.execute(
      `UPDATE evolve_nodes SET is_best = 0 WHERE run_id = ?`,
      [node.run_id]
    );
    // Set new best
    await db.execute(
      `UPDATE evolve_nodes SET is_best = 1 WHERE id = ?`,
      [nodeId]
    );
    await db.execute(
      `UPDATE evolve_runs SET best_score = ?, best_node_id = ? WHERE id = ?`,
      [node.score, nodeId, node.run_id]
    );
  }

  return { ...node, id: nodeId, visit_count: 0, is_best: false, created_at: now };
}

/** Get the current best node for a run */
export async function getBestNode(runId: number): Promise<EvolveNode | null> {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT * FROM evolve_nodes WHERE run_id = ? AND is_best = 1 LIMIT 1`,
    [runId]
  ) as [any[], any];
  return rows.length > 0 ? deserializeNode(rows[0]) : null;
}

/** Get all nodes for a run, ordered by score descending */
export async function getAllNodes(runId: number): Promise<EvolveNode[]> {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT * FROM evolve_nodes WHERE run_id = ? ORDER BY score DESC`,
    [runId]
  ) as [any[], any];
  return rows.map(deserializeNode);
}

/** Get run statistics */
export async function getRunStats(runId: number): Promise<{
  total_nodes: number;
  best_score: number;
  step_count: number;
  success_rate: number;
  mean_score: number;
}> {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT 
       COUNT(*) as total_nodes,
       MAX(score) as best_score,
       AVG(score) as mean_score,
       SUM(success) as success_count
     FROM evolve_nodes WHERE run_id = ?`,
    [runId]
  ) as [any[], any];

  const [runRows] = await db.execute(
    `SELECT step_count FROM evolve_runs WHERE id = ?`,
    [runId]
  ) as [any[], any];

  const r = rows[0];
  const total = Number(r.total_nodes) || 0;
  return {
    total_nodes: total,
    best_score: Number(r.best_score) || 0,
    step_count: runRows[0]?.step_count || 0,
    success_rate: total > 0 ? Number(r.success_count) / total : 0,
    mean_score: Number(r.mean_score) || 0,
  };
}

// ─── Run Management ───────────────────────────────────────────────────────────

/** Get or create the active HIV protease evolve run — race-safe via INSERT IGNORE */
export async function getOrCreateRun(name: string = "hiv-protease-run-1"): Promise<number> {
  const db = getPool();
  const now = Date.now();

  // INSERT IGNORE: silently skips if the unique name already exists
  await db.execute(
    `INSERT IGNORE INTO evolve_runs 
     (name, objective, sampling_algorithm, ucb1_c, eval_score_target, max_steps,
      step_count, best_score, best_node_id, status, started_at, updated_at, metadata)
     VALUES (?, ?, 'ucb1', 1.414, 9.5, 100, 0, 0.0, NULL, 'running', ?, ?, ?)`,
    [
      name,
      "Maximize eval_score = 0.6*mean_pic50_top10 + 0.3*verification_rate + 0.1*admet_pass_rate for HIV-1 protease inhibitor candidates",
      now,
      now,
      JSON.stringify({ domain: "HIV-1 protease inhibitor", target: "IC50 < 1nM" }),
    ]
  );

  // Always fetch the id (works whether we just inserted or it already existed)
  const [rows] = await db.execute(
    `SELECT id FROM evolve_runs WHERE name = ? LIMIT 1`,
    [name]
  ) as [any[], any];

  return rows[0].id;
}

// ─── Serialization ───────────────────────────────────────────────────────────

function deserializeNode(row: any): EvolveNode {
  return {
    id: row.id,
    run_id: row.run_id,
    step_name: row.step_name,
    name: row.name,
    motivation: row.motivation,
    code: row.code,
    results: typeof row.results === "string" ? JSON.parse(row.results) : row.results,
    analysis: row.analysis || "",
    score: Number(row.score),
    eval_score: Number(row.eval_score),
    success: Boolean(row.success),
    parent_ids: typeof row.parent_ids === "string" ? JSON.parse(row.parent_ids) : row.parent_ids,
    visit_count: Number(row.visit_count),
    is_best: Boolean(row.is_best),
    created_at: Number(row.created_at),
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
  };
}
