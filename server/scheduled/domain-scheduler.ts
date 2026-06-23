/**
 * Domain Scheduler — Phase-E
 *
 * Heartbeat-triggered handler that runs one verification cycle for every
 * enabled domain in DOMAIN_REGISTRY.
 *
 * Cron: 0 0 1/4 * * *  →  01:00, 05:00, 09:00, 13:00, 17:00, 21:00 UTC
 * (offset by +1 hour from the HIV loop at :00 and the verification loop at :02)
 *
 * Registration is idempotent — safe to call on every server startup.
 */

import type { Request, Response } from "express";
import {
  createHeartbeatJob,
  listHeartbeatJobs,
} from "../_core/heartbeat";
import { runDomainBatch } from "../discovery/asi-evolve/domain-orchestrator";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const DOMAIN_JOB_NAME = "hiv-domain-scheduler";
export const DOMAIN_JOB_PATH = "/api/scheduled/domain-scheduler";
// Fires at 01:00, 05:00, 09:00, 13:00, 17:00, 21:00 UTC
export const DOMAIN_JOB_CRON = "0 0 1/4 * * *";

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat registration
// ─────────────────────────────────────────────────────────────────────────────

export async function registerDomainSchedulerHeartbeat(): Promise<void> {
  try {
    const existing = await listHeartbeatJobs("" /* owner session */);
    const alreadyRegistered = (existing?.jobs ?? []).some(
      (j: { name: string }) => j.name === DOMAIN_JOB_NAME
    );

    if (alreadyRegistered) {
      console.log(
        `[DomainScheduler] Heartbeat job '${DOMAIN_JOB_NAME}' already registered — skipping.`
      );
      return;
    }

    const result = await createHeartbeatJob(
      {
        name: DOMAIN_JOB_NAME,
        path: DOMAIN_JOB_PATH,
        cron: DOMAIN_JOB_CRON,
        method: "POST",
        payload: { source: "heartbeat" },
        description: "Cross-domain discovery-verification batch (Phase-E)",
      },
      "" /* owner session */
    );
    console.log(
      `[DomainScheduler] Registered Heartbeat job '${DOMAIN_JOB_NAME}' ` +
        `(cron: ${DOMAIN_JOB_CRON}, taskUid=${result.taskUid})`
    );
  } catch (err) {
    console.warn("[DomainScheduler] Failed to register Heartbeat job:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Express handler
// ─────────────────────────────────────────────────────────────────────────────

export async function domainSchedulerHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate Heartbeat token
  const auth = req.headers["authorization"] ?? "";
  const token = process.env.WUKONG_API_TOKEN ?? "";
  if (token && auth !== `Bearer ${token}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Respond immediately — Heartbeat expects a fast 2xx
  res.status(202).json({
    message: "Domain batch accepted",
    timestamp: new Date().toISOString(),
  });

  // Run non-blocking
  setImmediate(async () => {
    console.log("[DomainScheduler] Starting domain batch...");
    try {
      const batch = await runDomainBatch({ parallel: false });
      console.log(
        `[DomainScheduler] Batch complete: ${batch.completed}/${batch.totalDomains} domains, ` +
          `${batch.totalClaimsVerified} total claims, ${batch.durationMs}ms`
      );
    } catch (err) {
      console.error("[DomainScheduler] Batch threw unexpectedly:", err);
    }
  });
}
