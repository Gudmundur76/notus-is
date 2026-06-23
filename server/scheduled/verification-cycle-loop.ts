/**
 * Scheduled Verification-Cycle Loop  -  Heartbeat callback handler
 *
 * This module:
 *   1. Registers a second cron job with the Manus Heartbeat service on server
 *      startup (every 4 hours, offset by 2 hours from the main discovery loop)
 *   2. Exports the Express route handler for POST /api/scheduled/verification-cycle
 *
 * Cron schedule: "0 0 2/4 * * *"  (02:00, 06:00, 10:00, 14:00, 18:00, 22:00 UTC)
 *
 * The offset of +2 hours from the main discovery loop ("0 0 0/4 * * *" fires at 00:00,
 * 04:00, 08:00, …) ensures the two jobs never overlap, avoiding DB contention
 * and giving each job a clean 2-hour window before the other starts.
 *
 * Relationship to the main discovery loop:
 *   - hiv-discovery-loop  (discovery-loop.ts)  → runs runVerificationCycle() as
 *     the primary 6-phase engine.  This is the "HIV protease" track.
 *   - hiv-verification-cycle (this file) → runs runVerificationCycle() as a
 *     cross-domain verification pass.  Shares the same function but fires on a
 *     separate schedule so the two loops compound knowledge independently.
 *
 * Both jobs are idempotent: if the Heartbeat service fires them concurrently
 * (e.g. after a server restart), the DB upsert logic in each phase prevents
 * duplicate records.
 */

import type { Request, Response } from "express";
import {
  createHeartbeatJob,
  listHeartbeatJobs,
} from "../_core/heartbeat";
import { runVerificationCycle } from "../discovery/verification-cycle";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const JOB_NAME = "hiv-verification-cycle";
const JOB_PATH = "/api/scheduled/verification-cycle";

/**
 * 6-field cron (seconds included): "0 0 2/4 * * *"
 *
 * Fires at: 02:00, 06:00, 10:00, 14:00, 18:00, 22:00 UTC.
 * This is a +2 hour offset from the main discovery loop ("0 0 0/4 * * *")
 * which fires at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC.
 *
 * Both loops therefore fire 6 times per day, interleaved every 2 hours,
 * giving 12 total cycle events per day over the 30-day campaign.
 */
const JOB_CRON = "0 0 2/4 * * *";

const JOB_DESCRIPTION =
  "HIV Protease Verification-Cycle Loop  -  runs one cross-domain " +
  "6-phase verification cycle (DISCOVER → SCORE → VERIFY → COGNITION → " +
  "EVOLVE → CONVERGENCE) every 4 hours, offset +2 h from the main " +
  "discovery loop. 6 cycles/day x 30 days = 180 total cycles.";

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat registration
// ─────────────────────────────────────────────────────────────────────────────

let registrationAttempted = false;

/**
 * Register the verification-cycle heartbeat job with the Manus scheduler.
 * Called once on server startup. Idempotent  -  skips if job already exists.
 */
export async function registerVerificationCycleHeartbeat(): Promise<void> {
  if (registrationAttempted) return;
  registrationAttempted = true;

  try {
    // Check if job already exists
    const existing = await listHeartbeatJobs("" /* owner session */);
    const alreadyRegistered = (existing?.jobs ?? []).some(
      (j) => j.name === JOB_NAME
    );

    if (alreadyRegistered) {
      console.log(
        `[Heartbeat] Verification-cycle job already registered (${JOB_NAME})`
      );
      return;
    }

    // Register new job
    const result = await createHeartbeatJob(
      {
        name: JOB_NAME,
        cron: JOB_CRON,
        path: JOB_PATH,
        method: "POST",
        payload: { source: "heartbeat", job: JOB_NAME },
        description: JOB_DESCRIPTION,
      },
      "" /* owner session */
    );

    console.log(
      `[Heartbeat] Verification-cycle registered: taskUid=${result.taskUid}, ` +
        `next=${result.nextExecutionAt ?? "unknown"}`
    );
  } catch (err) {
    // Non-fatal: log and continue. The cycle can still be triggered manually.
    console.warn(
      "[Heartbeat] Failed to register verification-cycle job:",
      err
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP callback handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/scheduled/verification-cycle
 *
 * Called by the Manus Heartbeat service every 4 hours (offset +2 h from the
 * main discovery loop).  Runs one full 6-phase verification cycle.
 *
 * Returns immediately with 202 Accepted while the cycle runs in the background.
 * The cycle result is persisted to the `verification_cycles` table and available
 * via trpc.discovery.verificationCycles / trpc.discovery.latestVerificationCycle.
 */
export async function verificationCycleHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate the request is from the Heartbeat service
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Respond immediately — don't block the heartbeat service
  res.status(202).json({
    status: "accepted",
    message: "Verification cycle started",
    job: JOB_NAME,
    timestamp: new Date().toISOString(),
  });

  // Run the unified 6-phase verification cycle (non-blocking).
  runVerificationCycle()
    .then((result) => {
      console.log(
        `[Scheduled:${JOB_NAME}] Cycle ${result.cycleId} ${result.status}: ` +
          `discovered=${result.candidatesDiscovered}, scored=${result.candidatesScored}, ` +
          `verified=${result.claimsVerified}, cognition+=${result.cognitionItemsAdded}, ` +
          `evolve=${result.evolveStepName ?? "none"}, convergence=${result.convergenceReached}, ` +
          `duration=${result.durationMs}ms`
      );
    })
    .catch((err) => {
      console.error(
        `[Scheduled:${JOB_NAME}] VerificationCycle failed:`,
        err
      );
    });
}
