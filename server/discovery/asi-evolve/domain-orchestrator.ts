/**
 * Domain Orchestrator — Phase-E
 *
 * Runs one verification cycle per domain in a configurable batch.
 * Supports:
 *   - Sequential mode (default): one domain at a time to avoid DB contention
 *   - Parallel mode: all domains concurrently (use only when DB allows it)
 *
 * After each cycle the per-domain daily summary row in `domain_cycle_summaries`
 * is upserted so the monitoring dashboard can show cross-domain stats.
 */

import { getDb } from "../../db";
import { domainCycleSummaries } from "../../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { runVerificationCycle } from "../verification-cycle";
import {
  DOMAIN_CONFIGS,
  getDomainConfig,
  ALL_DOMAIN_CONFIGS,
} from "../domain-configs";
import type { DomainId } from "../../../shared/types/domain.js";
import type { DomainConfig } from "../../../shared/types/domain.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DomainRunResult {
  domainId: string;
  domainName: string;
  cycleId: string;
  status: "completed" | "failed" | "skipped";
  claimsVerified: number;
  bestPic50: number | null;
  durationMs: number | null;
  error?: string;
}

export interface DomainBatchResult {
  batchId: string;
  startedAt: Date;
  completedAt: Date;
  totalDomains: number;
  completed: number;
  failed: number;
  skipped: number;
  results: DomainRunResult[];
  totalClaimsVerified: number;
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily summary upsert
// ─────────────────────────────────────────────────────────────────────────────

async function upsertDomainSummary(
  domainId: string,
  result: DomainRunResult
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  try {
    // Try insert first; on duplicate key update the aggregates
    await db.execute(sql`
      INSERT INTO domain_cycle_summaries
        (domain_id, date, cycles_completed, cycles_failed,
         total_claims_verified, best_pic50, avg_duration_ms)
      VALUES
        (${domainId}, ${today},
         ${result.status === "completed" ? 1 : 0},
         ${result.status === "failed" ? 1 : 0},
         ${result.claimsVerified},
         ${result.bestPic50 ?? null},
         ${result.durationMs ?? null})
      ON DUPLICATE KEY UPDATE
        cycles_completed = cycles_completed + ${result.status === "completed" ? 1 : 0},
        cycles_failed    = cycles_failed    + ${result.status === "failed" ? 1 : 0},
        total_claims_verified = total_claims_verified + ${result.claimsVerified},
        best_pic50 = CASE
          WHEN best_pic50 IS NULL THEN ${result.bestPic50 ?? null}
          WHEN ${result.bestPic50 ?? null} IS NULL THEN best_pic50
          ELSE GREATEST(best_pic50, ${result.bestPic50 ?? null})
        END,
        avg_duration_ms = CASE
          WHEN avg_duration_ms IS NULL THEN ${result.durationMs ?? null}
          ELSE ROUND((avg_duration_ms + ${result.durationMs ?? 0}) / 2)
        END
    `);
  } catch (err) {
    console.warn(`[DomainOrchestrator] Failed to upsert summary for ${domainId}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Run a single domain
// ─────────────────────────────────────────────────────────────────────────────

async function runDomain(domain: DomainConfig): Promise<DomainRunResult> {
  const start = Date.now();
  console.log(`[DomainOrchestrator] Starting domain: ${domain.id} (${domain.name})`);

  try {
    const cycle = await runVerificationCycle(domain);

    const result: DomainRunResult = {
      domainId: domain.id,
      domainName: domain.name,
      cycleId: cycle.cycleId,
      status: cycle.status === "failed" ? "failed" : "completed",
      claimsVerified: cycle.claimsVerified,
      bestPic50: cycle.bestPic50,
      durationMs: cycle.durationMs ?? Date.now() - start,
      ...(cycle.errorMessage ? { error: cycle.errorMessage } : {}),
    };

    await upsertDomainSummary(domain.id, result);
    console.log(
      `[DomainOrchestrator] ${domain.id} ${result.status} — ` +
        `claims=${result.claimsVerified}, pIC50=${result.bestPic50?.toFixed(2) ?? "N/A"}, ` +
        `${result.durationMs}ms`
    );
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[DomainOrchestrator] ${domain.id} threw:`, msg);

    const result: DomainRunResult = {
      domainId: domain.id,
      domainName: domain.name,
      cycleId: "error",
      status: "failed",
      claimsVerified: 0,
      bestPic50: null,
      durationMs: Date.now() - start,
      error: msg,
    };

    await upsertDomainSummary(domain.id, result);
    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface DomainBatchOptions {
  /** Domain IDs to include. Defaults to all enabled domains. */
  domainIds?: DomainId[];
  /** Run domains in parallel instead of sequentially. Default: false. */
  parallel?: boolean;
  /** Skip domains whose priority is below this threshold. Default: 0. */
  minPriority?: number;
}

/**
 * Run one verification cycle for each specified domain.
 * Sequential by default to avoid DB contention.
 */
export async function runDomainBatch(
  options: DomainBatchOptions = {}
): Promise<DomainBatchResult> {
  const { domainIds, parallel = false, minPriority = 0 } = options;

  const batchId = `batch-${Date.now()}`;
  const batchStart = Date.now();

  // Select domains
  let domains: DomainConfig[] = ALL_DOMAIN_CONFIGS;

  if (domainIds && domainIds.length > 0) {
    domains = domains.filter((d) => domainIds.includes(d.id as DomainId));
  }

  // minPriority filter is a no-op if DomainConfig has no priority field;
  // kept for API compatibility — future: add priority to DomainConfig

  console.log(
    `[DomainOrchestrator] Batch ${batchId}: ${domains.length} domains, ` +
      `mode=${parallel ? "parallel" : "sequential"}`
  );

  let results: DomainRunResult[];

  if (parallel) {
    results = await Promise.all(domains.map((d) => runDomain(d)));
  } else {
    results = [];
    for (const domain of domains) {
      results.push(await runDomain(domain));
    }
  }

  const completed = results.filter((r) => r.status === "completed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const totalClaimsVerified = results.reduce((s, r) => s + r.claimsVerified, 0);

  const batch: DomainBatchResult = {
    batchId,
    startedAt: new Date(batchStart),
    completedAt: new Date(),
    totalDomains: domains.length,
    completed,
    failed,
    skipped,
    results,
    totalClaimsVerified,
    durationMs: Date.now() - batchStart,
  };

  console.log(
    `[DomainOrchestrator] Batch ${batchId} done: ` +
      `${completed}/${domains.length} completed, ${failed} failed, ` +
      `${totalClaimsVerified} total claims, ${batch.durationMs}ms`
  );

  return batch;
}

/**
 * Run a single domain by ID.
 * Convenience wrapper for tRPC trigger procedures.
 */
export async function runSingleDomain(domainId: DomainId): Promise<DomainRunResult> {
  let domain: DomainConfig | undefined;
  try { domain = getDomainConfig(domainId); } catch { domain = undefined; }
  if (!domain) {
    return {
      domainId,
      domainName: domainId,
      cycleId: "not-found",
      status: "skipped",
      claimsVerified: 0,
      bestPic50: null,
      durationMs: 0,
      error: `Domain '${domainId}' not found in registry`,
    };
  }
  return runDomain(domain);
}

/**
 * Get today's summary for all domains from the DB.
 */
export async function getTodayDomainSummaries(): Promise<
  Array<{
    domainId: string;
    cyclesCompleted: number;
    cyclesFailed: number;
    totalClaimsVerified: number;
    bestPic50: number | null;
    avgDurationMs: number | null;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  const today = new Date().toISOString().slice(0, 10);

  try {
    const rows = await db
      .select()
      .from(domainCycleSummaries)
      .where(eq(domainCycleSummaries.date, today));

    return rows.map((r) => ({
      domainId: r.domainId,
      cyclesCompleted: r.cyclesCompleted,
      cyclesFailed: r.cyclesFailed,
      totalClaimsVerified: r.totalClaimsVerified,
      bestPic50: r.bestPic50 ?? null,
      avgDurationMs: r.avgDurationMs ?? null,
    }));
  } catch (err) {
    console.warn("[DomainOrchestrator] Failed to fetch today summaries:", err);
    return [];
  }
}
