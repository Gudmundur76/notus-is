/**
 * ASI-Evolve Run State Persistence — TypeScript port of evolve_core/run_state.py
 *
 * Serializes the full run state to the database so the loop can resume
 * correctly after a server restart. Persists:
 *   - managedPrompts: Manager-tuned Researcher/Analyzer system prompts
 *   - islandSamplerState: current island rotation, generation counts
 *   - bestScore: tracked by BestSnapshotManager
 *
 * In the Python source (evolve_core/run_state.py), state is written to
 * a JSON file on disk. Here we persist to the `evolve_runs` table using
 * two JSON columns: `managed_prompts` and `island_state`.
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve/blob/main/evolve_core/run_state.py
 */

import mysql from "mysql2/promise";
import type { ManagedPrompts } from "./manager";
import { initManagedPrompts } from "./manager";

let _pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}

// ─── Serializable Island State ────────────────────────────────────────────────

/**
 * Serializable snapshot of IslandSampler state.
 * We persist currentIsland and lastMigrationGeneration since those are
 * the only pieces of state that matter for resumability.
 * Island membership is rebuilt from DB nodes on each sample() call.
 */
export interface IslandSamplerState {
  currentIsland: number;
  lastMigrationGeneration: number;
  islandGenerations: number[];  // generation count per island
}

// ─── Full Run State ───────────────────────────────────────────────────────────

export interface RunState {
  managedPrompts: ManagedPrompts;
  islandSamplerState: IslandSamplerState | null;
  bestScore: number;
  savedAt: number;
}

// ─── Persistence Functions ────────────────────────────────────────────────────

/**
 * Save the full run state to the database.
 * Mirrors RunState.save() from the Python source.
 */
export async function saveRunState(
  runId: number,
  managedPrompts: ManagedPrompts,
  islandSamplerState: IslandSamplerState | null,
  bestScore: number
): Promise<void> {
  const db = getPool();
  const now = Date.now();

  const state: RunState = {
    managedPrompts,
    islandSamplerState,
    bestScore,
    savedAt: now,
  };

  try {
    await db.execute(
      `UPDATE evolve_runs 
       SET managed_prompts = ?, island_state = ?, updated_at = ?
       WHERE id = ?`,
      [
        JSON.stringify(managedPrompts),
        islandSamplerState ? JSON.stringify(islandSamplerState) : null,
        now,
        runId,
      ]
    );
    console.log(
      `[RunState] Saved state for run ${runId}: ` +
      `promptVersion=${managedPrompts.stepCount}, ` +
      `bestScore=${bestScore.toFixed(3)}, ` +
      `island=${islandSamplerState?.currentIsland ?? "N/A"}`
    );
  } catch (err) {
    console.error("[RunState] Failed to save run state:", err);
    // Non-fatal — the loop continues even if state save fails
  }
}

/**
 * Load the run state from the database.
 * Mirrors RunState.load() from the Python source.
 * Returns null if no state has been saved yet (first run).
 */
export async function loadRunState(runId: number): Promise<RunState | null> {
  const db = getPool();

  try {
    const [rows] = await db.execute(
      `SELECT managed_prompts, island_state, best_score FROM evolve_runs WHERE id = ?`,
      [runId]
    ) as [any[], any];

    if (rows.length === 0) return null;

    const row = rows[0];

    // If managed_prompts column is null, no state has been saved yet
    if (!row.managed_prompts) return null;

    const managedPrompts: ManagedPrompts =
      typeof row.managed_prompts === "string"
        ? JSON.parse(row.managed_prompts)
        : row.managed_prompts;

    const islandSamplerState: IslandSamplerState | null =
      row.island_state
        ? (typeof row.island_state === "string"
            ? JSON.parse(row.island_state)
            : row.island_state)
        : null;

    // Use the DB best_score as the initial tracker value
    const bestScore = Number(row.best_score) || 0;

    const state: RunState = {
      managedPrompts,
      islandSamplerState,
      bestScore,
      savedAt: Date.now(),
    };

    console.log(
      `[RunState] Loaded state for run ${runId}: ` +
      `promptVersion=${managedPrompts.stepCount}, ` +
      `bestScore=${bestScore.toFixed(3)}, ` +
      `island=${islandSamplerState?.currentIsland ?? "N/A"}`
    );

    return state;
  } catch (err) {
    console.error("[RunState] Failed to load run state:", err);
    return null;
  }
}

/**
 * Initialize a default run state (used on first run or when load fails).
 * Mirrors RunState.default() from the Python source.
 */
export function defaultRunState(): RunState {
  return {
    managedPrompts: initManagedPrompts(),
    islandSamplerState: null,
    bestScore: 0,
    savedAt: Date.now(),
  };
}
