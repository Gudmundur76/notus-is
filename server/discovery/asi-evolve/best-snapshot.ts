/**
 * ASI-Evolve BestSnapshotManager — TypeScript port of utils/best_snapshot.py
 *
 * Persists the best-scoring step outputs to the database.
 * In the Python source, this writes to steps/best/ on disk.
 * In our implementation, we persist to the evolve_nodes table with a
 * special "is_best_snapshot" flag in meta_info.
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve/blob/main/utils/best_snapshot.py
 */

import mysql from "mysql2/promise";
import type { EvolveNode } from "./types";

let _pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}

export class BestSnapshotManager {
  private bestScore: number = -Infinity;
  private runId: number;

  constructor(runId: number) {
    this.runId = runId;
  }

  /**
   * Initialize the best-score tracker from existing nodes.
   * Mirrors BestSnapshotManager.init_from_nodes() from the Python source.
   */
  async initFromNodes(nodes: EvolveNode[]): Promise<void> {
    if (nodes.length === 0) return;
    const best = nodes.reduce((a, b) => ((a.score || 0) > (b.score || 0) ? a : b));
    this.bestScore = best.score || -Infinity;
  }

  /**
   * Initialize the best-score tracker from a persisted score value.
   * Used by run-state.ts to restore state after a server restart.
   */
  async initFromBestScore(score: number): Promise<void> {
    this.bestScore = score > 0 ? score : -Infinity;
  }

  /**
   * Write a new snapshot if the provided node improves on the best score.
   * Mirrors BestSnapshotManager.update_if_better() from the Python source.
   *
   * @returns true if a new best was recorded, false otherwise
   */
  async updateIfBetter(node: EvolveNode, stepName: string): Promise<boolean> {
    if ((node.score || 0) <= this.bestScore) return false;

    this.bestScore = node.score || 0;
    await this._writeSnapshot(node, stepName);
    console.log(
      `[BestSnapshot] New best: ${node.name} (score=${(node.score || 0).toFixed(4)}) at step ${stepName}`
    );
    return true;
  }

  /**
   * Get the current best score.
   */
  getBestScore(): number {
    return this.bestScore;
  }

  /**
   * Persist the snapshot to the database by marking the node as a best snapshot.
   * Mirrors BestSnapshotManager._write_snapshot() from the Python source.
   */
  private async _writeSnapshot(node: EvolveNode, stepName: string): Promise<void> {
    if (!node.id) return;
    const pool = getPool();

    // Clear previous best snapshots for this run
    await pool.execute(
      `UPDATE evolve_nodes SET meta_info = JSON_REMOVE(meta_info, '$.is_best_snapshot')
       WHERE run_id = ? AND JSON_EXTRACT(meta_info, '$.is_best_snapshot') = true`,
      [this.runId]
    );

    // Mark this node as the best snapshot
    const currentMeta = node.metadata ? JSON.parse(JSON.stringify(node.metadata)) : {};
    currentMeta.is_best_snapshot = true;
    currentMeta.best_step_name = stepName;
    currentMeta.best_recorded_at = Date.now();

    await pool.execute(
      `UPDATE evolve_nodes SET meta_info = ? WHERE id = ?`,
      [JSON.stringify(currentMeta), node.id]
    );
  }

  /**
   * Load the current best snapshot node from the database.
   */
  async loadBestSnapshot(): Promise<EvolveNode | null> {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM evolve_nodes 
       WHERE run_id = ? AND JSON_EXTRACT(meta_info, '$.is_best_snapshot') = true
       ORDER BY score DESC LIMIT 1`,
      [this.runId]
    ) as [any[], any];

    if (rows.length === 0) return null;
    return deserializeNode(rows[0]);
  }
}

// ─── Serialization helper ─────────────────────────────────────────────────────

function deserializeNode(row: any): EvolveNode {
    return {
    id: row.id,
    run_id: row.run_id,
    step_name: row.step_name || '',
    name: row.name,
    motivation: row.motivation || '',
    code: row.code || '',
    results: typeof row.results === "string" ? JSON.parse(row.results) : (row.results || {}),
    analysis: row.analysis || '',
    score: Number(row.score || 0),
    eval_score: Number(row.eval_score || 0),
    success: Boolean(row.success),
    visit_count: Number(row.visit_count || 0),
    parent_ids: typeof row.parent_ids === "string" ? JSON.parse(row.parent_ids) : (row.parent_ids || []),
    is_best: Boolean(row.is_best),
    created_at: Number(row.created_at),
    metadata: typeof row.meta_info === "string" ? JSON.parse(row.meta_info) : (row.meta_info || {}),
  };
}
