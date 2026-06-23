/**
 * Scheduled Discovery Loop  -  Heartbeat callback handler
 *
 * This module:
 *   1. Registers the discovery loop cron job with the Manus Heartbeat service
 *      on server startup (every 4 hours = 6 cycles/day x 30 days = 180 cycles)
 *   2. Exports the Express route handler for POST /api/scheduled/discovery-loop
 *
 * Cron schedule: "0 0 *\/4 * * *"  (every 4 hours, at minute 0)
 * This gives 6 cycles per day, 180 cycles over 30 days.
 *
 * The heartbeat service calls our callback URL, which runs one micro-cycle
 * of the HIV protease discovery engine.
 */

import type { Request, Response } from "express";
import {
  createHeartbeatJob,
  listHeartbeatJobs,
} from "../_core/heartbeat";
import { runSingleCycle } from "../discovery/loop";
import { runEvolveStep } from "../discovery/asi-evolve/orchestrator";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const JOB_NAME = "hiv-discovery-loop";
const JOB_PATH = "/api/scheduled/discovery-loop";
const JOB_CRON = "0 0 */4 * * *"; // Every 4 hours
const JOB_DESCRIPTION =
  "HIV Protease Discovery Loop  -  runs one micro-cycle of the 4-track " +
  "molecule generation, ML ensemble scoring, quantum scoring, and citation " +
  "verification pipeline. 6 cycles/day x 30 days = 180 total cycles.";

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat registration
// ─────────────────────────────────────────────────────────────────────────────

let registrationAttempted = false;

/**
 * Register the discovery loop heartbeat job with the Manus scheduler.
 * Called once on server startup. Idempotent  -  skips if job already exists.
 */
export async function registerDiscoveryLoopHeartbeat(): Promise<void> {
  if (registrationAttempted) return;
  registrationAttempted = true;

  try {
    // Check if job already exists
    const existing = await listHeartbeatJobs("" /* owner session */);
    const alreadyRegistered = (existing?.jobs ?? []).some(j => j.name === JOB_NAME);

    if (alreadyRegistered) {
      console.log(`[Heartbeat] Discovery loop job already registered (${JOB_NAME})`);
      return;
    }

    // Register new job
    const result = await createHeartbeatJob(
      {
        name: JOB_NAME,
        cron: JOB_CRON,
        path: JOB_PATH,
        method: "POST",
        payload: { source: "heartbeat" },
        description: JOB_DESCRIPTION,
      },
      "" /* owner session */
    );

    console.log(
      `[Heartbeat] Discovery loop registered: taskUid=${result.taskUid}, ` +
      `next=${result.nextExecutionAt ?? "unknown"}`
    );
  } catch (err) {
    // Non-fatal: log and continue. The loop can still be triggered manually.
    console.warn("[Heartbeat] Failed to register discovery loop job:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP callback handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/scheduled/discovery-loop
 *
 * Called by the Manus Heartbeat service every 4 hours.
 * Runs one micro-cycle of the discovery engine.
 *
 * Returns immediately with 202 Accepted while the cycle runs in the background.
 * The cycle result is persisted to the database and available via the tRPC API.
 */
export async function discoveryLoopHandler(req: Request, res: Response): Promise<void> {
  // Validate the request is from the Heartbeat service
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Respond immediately  -  don't block the heartbeat service
  res.status(202).json({
    status: "accepted",
    message: "Discovery cycle started",
    timestamp: new Date().toISOString(),
  });

  // Run both engines in parallel (non-blocking)
  Promise.allSettled([
    runSingleCycle().then(result => {
      console.log(
        `[Scheduled] Legacy cycle ${result.cycleNumber} complete: ` +
        `${result.candidatesGenerated} generated, ${result.candidatesVerified} verified, ` +
        `best pIC50=${result.bestPic50.toFixed(2)}, duration=${result.durationMs}ms`
      );
    }),
    runEvolveStep().then(result => {
      console.log(
        `[Scheduled] ASI-Evolve ${result.step_name} complete: ` +
        `score=${result.score.toFixed(3)}, best_pic50=${result.best_pic50.toFixed(2)}, ` +
        `new_best=${result.is_new_best}, elapsed=${result.elapsed_ms}ms`
      );
    }),
  ]).catch(err => {
    console.error("[Scheduled] Engine run failed:", err);
  });
}
