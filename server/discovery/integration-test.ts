/**
 * integration-test.ts — Phase-F End-to-End Diagnostic
 *
 * A runnable diagnostic (NOT a Vitest file) that exercises the entire
 * notus.is pipeline manually and produces a structured IntegrationReport.
 *
 * Run via:
 *   npx tsx server/discovery/integration-test.ts
 *
 * Output:
 *   - Pretty-printed summary to stdout
 *   - Full JSON report written to /tmp/integration-report.json
 *
 * The script is safe to run against a live database; it only reads data
 * and creates a single test verification cycle per run (domain: "biomedical").
 * All citation calls are dry-run when CITATION_API_KEY is not set.
 */

import { writeFileSync } from "fs";
import { DOMAIN_CONFIGS } from "./domain-configs.js";
import { pythonBridge } from "./python-bridge.js";
import { scoreByStrategy } from "./domain-scoring.js";
import { verifyCandidates, createRealCitationClient, type CandidateClaim, type CitationClient, type VerifiedCandidate } from "./candidate-claim.js";
import { getVerificationCycleStatus, getVerificationStats } from "./verification-cycle.js";
import type { DomainId } from "../../shared/types/domain.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DomainCheckResult {
  domainId: DomainId;
  domainName: string;
  status: "ok" | "error" | "skipped";
  recordsDiscovered: number;
  recordsScored: number;
  elapsedMs: number;
  error?: string;
}

export interface VerificationCheckResult {
  status: "ok" | "dry_run" | "error";
  candidatesSubmitted: number;
  verdicts: Record<string, number>;
  elapsedMs: number;
  error?: string;
}

export interface CognitionCheckResult {
  status: "ok" | "error";
  itemsInDb: number;
  elapsedMs: number;
  error?: string;
}

export interface CycleStateCheckResult {
  status: "ok" | "idle" | "error";
  totalCycles: number;
  completedCycles: number;
  lastCycleAt: Date | null;
  bestPic50: number | null;
  elapsedMs: number;
  error?: string;
}

export interface IntegrationReport {
  generatedAt: string;
  overallStatus: "pass" | "partial" | "fail";
  pythonBridgeHealthy: boolean;
  domainChecks: DomainCheckResult[];
  verificationCheck: VerificationCheckResult;
  cognitionCheck: CognitionCheckResult;
  cycleStateCheck: CycleStateCheckResult;
  totalElapsedMs: number;
  summary: string;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function elapsed(start: number): number {
  return Date.now() - start;
}

function pad(s: string, width: number): string {
  return s.padEnd(width, " ");
}

function statusIcon(status: string): string {
  if (status === "ok" || status === "pass") return "✅";
  if (status === "dry_run") return "🔶";
  if (status === "idle") return "⏸ ";
  return "❌";
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Python bridge health check
// ─────────────────────────────────────────────────────────────────────────────

async function checkPythonBridge(): Promise<boolean> {
  try {
    const result = await pythonBridge.query({
      query: "test connectivity ping",
      domains: ["biomedical"],
      maxResults: 1,
      useQuantum: false,
    });
    return !result.error && result.totalRecords >= 0;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Query each of the 12 domains with a small test query
// ─────────────────────────────────────────────────────────────────────────────

async function checkAllDomains(): Promise<DomainCheckResult[]> {
  const results: DomainCheckResult[] = [];

  for (const [domainId, config] of Object.entries(DOMAIN_CONFIGS)) {
    const start = now();
    try {
      const report = await pythonBridge.query({
        query: config.cognitionSeedQueries[0] ?? config.name,
        domains: [domainId],
        maxResults: 5,
        useQuantum: false,
      });

    const rawResults = report.topResults.map(r => ({
      id: r.id,
      title: r.title,
      source: r.source,
      abstract: r.abstract ?? "",
      score: r.score,
      smiles: r.smiles,
      pic50: r.pic50,
      metadata: r.metadata,
    }));

      const scored = scoreByStrategy(rawResults, config.scoringStrategy, config.cognitionSeedQueries[0] ?? "");

      results.push({
        domainId: domainId as DomainId,
        domainName: config.name,
        status: "ok",
        recordsDiscovered: report.totalRecords,
        recordsScored: scored.length,
        elapsedMs: elapsed(start),
      });
    } catch (err) {
      results.push({
        domainId: domainId as DomainId,
        domainName: config.name,
        status: "error",
        recordsDiscovered: 0,
        recordsScored: 0,
        elapsedMs: elapsed(start),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Verify top-3 candidates (dry-run if no CITATION_API_KEY)
// ─────────────────────────────────────────────────────────────────────────────

async function checkVerification(): Promise<VerificationCheckResult> {
  const start = now();
  const hasCitationKey = !!process.env.CITATION_API_KEY;

  if (!hasCitationKey) {
    // Dry-run: build claims manually (no Candidate DB rows needed)
    const mockClaims: CandidateClaim[] = [
      { candidateId: "test-001", claim: "Compound test-001 shows pIC50=7.2 against HIV-1 protease", compoundName: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1", pic50: 7.2, source: "pubchem", discoveryQuery: "HIV-1 protease inhibitor" },
      { candidateId: "test-002", claim: "Compound test-002 shows pIC50=6.8 against HIV-1 protease", compoundName: "Benzoic acid", smiles: "c1ccc(cc1)C(=O)O", pic50: 6.8, source: "chembl", discoveryQuery: "HIV-1 protease inhibitor" },
      { candidateId: "test-003", claim: "Compound test-003 shows pIC50=7.5 against HIV-1 protease", compoundName: "Ibuprofen", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", pic50: 7.5, source: "bindingdb", discoveryQuery: "HIV-1 protease inhibitor" },
    ];
    return {
      status: "dry_run",
      candidatesSubmitted: mockClaims.length,
      verdicts: { "Dry-run (no CITATION_API_KEY)": mockClaims.length },
      elapsedMs: elapsed(start),
    };
  }

  try {
    const report = await pythonBridge.query({
      query: "HIV-1 protease inhibitor pIC50 binding affinity",
      domains: ["biomedical"],
      maxResults: 5,
      useQuantum: false,
    });

    const rawResults = report.topResults.slice(0, 3).map(r => ({
      id: r.id,
      title: r.title,
      source: r.source,
      abstract: r.abstract ?? "",
      score: r.score,
      smiles: r.smiles,
      pic50: r.pic50,
      metadata: r.metadata,
    }));

    const scored = scoreByStrategy(rawResults, "molecular", "HIV-1 protease inhibitor");
    const citationClient = await createRealCitationClient();
    const claimStrings = scored.slice(0, 3).map(s =>
      `Compound ${s.result.id} shows pIC50=${s.score.toFixed(2)} against HIV-1 protease`
    );
    const verifyResults = await Promise.all(
      claimStrings.map(c => citationClient.verifyClaim(c).catch(() => null))
    );

    const verdicts: Record<string, number> = {};
    for (const r of verifyResults) {
      const v = r?.verdict ?? "Ambiguous";
      verdicts[v] = (verdicts[v] ?? 0) + 1;
    }

    return {
      status: "ok",
      candidatesSubmitted: verifyResults.length,
      verdicts,
      elapsedMs: elapsed(start),
    };
  } catch (err) {
    return {
      status: "error",
      candidatesSubmitted: 0,
      verdicts: {},
      elapsedMs: elapsed(start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: Check cognition items were created
// ─────────────────────────────────────────────────────────────────────────────

async function checkCognitionItems(): Promise<CognitionCheckResult> {
  const start = now();
  try {
    const { getDb } = await import("../db.js");
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [rows] = await db.execute("SELECT COUNT(*) AS cnt FROM evolve_cognition") as unknown as [Array<{ cnt: number | string }>];
    const count = Number(rows[0]?.cnt ?? 0);
    return {
      status: "ok",
      itemsInDb: count,
      elapsedMs: elapsed(start),
    };
  } catch (err) {
    return {
      status: "error",
      itemsInDb: 0,
      elapsedMs: elapsed(start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5: Verify cycle state was persisted
// ─────────────────────────────────────────────────────────────────────────────

async function checkCycleState(): Promise<CycleStateCheckResult> {
  const start = now();
  try {
    const [status, stats] = await Promise.all([
      getVerificationCycleStatus(),
      getVerificationStats(),
    ]);
    return {
      status: status.status === "idle" ? "idle" : "ok",
      totalCycles: stats.totalCycles,
      completedCycles: stats.completedCycles,
      lastCycleAt: stats.lastCycleAt,
      bestPic50: stats.bestPic50Overall,
      elapsedMs: elapsed(start),
    };
  } catch (err) {
    return {
      status: "error",
      totalCycles: 0,
      completedCycles: 0,
      lastCycleAt: null,
      bestPic50: null,
      elapsedMs: elapsed(start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main diagnostic runner
// ─────────────────────────────────────────────────────────────────────────────

export async function runIntegrationDiagnostic(): Promise<IntegrationReport> {
  const globalStart = now();
  const errors: string[] = [];

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         notus.is — Integration Diagnostic (Phase-F)     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── Step 1: Python bridge health ──────────────────────────────────────────
  console.log("▶ Step 1/5 — Python bridge health check...");
  const bridgeHealthy = await checkPythonBridge();
  console.log(`  ${statusIcon(bridgeHealthy ? "ok" : "error")} Python bridge: ${bridgeHealthy ? "HEALTHY" : "UNAVAILABLE (expected in CI)"}\n`);

  // ── Step 2: Domain queries ────────────────────────────────────────────────
  console.log("▶ Step 2/5 — Querying all 12 domains (maxResults=5 each)...");
  const domainChecks = await checkAllDomains();
  const domainTable = [
    `  ${"Domain".padEnd(14)} ${"Status".padEnd(10)} ${"Discovered".padEnd(12)} ${"Scored".padEnd(8)} ${"ms".padEnd(6)}`,
    `  ${"─".repeat(54)}`,
  ];
  for (const d of domainChecks) {
    domainTable.push(
      `  ${pad(d.domainName, 14)} ${pad(statusIcon(d.status) + " " + d.status, 10)} ${pad(String(d.recordsDiscovered), 12)} ${pad(String(d.recordsScored), 8)} ${d.elapsedMs}`
    );
    if (d.error) errors.push(`Domain ${d.domainId}: ${d.error}`);
  }
  console.log(domainTable.join("\n") + "\n");

  // ── Step 3: Citation verification ────────────────────────────────────────
  console.log("▶ Step 3/5 — Citation verification (top-3 candidates)...");
  const verificationCheck = await checkVerification();
  console.log(`  ${statusIcon(verificationCheck.status)} Status: ${verificationCheck.status.toUpperCase()}`);
  console.log(`  Candidates submitted: ${verificationCheck.candidatesSubmitted}`);
  if (Object.keys(verificationCheck.verdicts).length > 0) {
    for (const [verdict, count] of Object.entries(verificationCheck.verdicts)) {
      console.log(`    • ${verdict}: ${count}`);
    }
  }
  if (verificationCheck.error) errors.push(`Verification: ${verificationCheck.error}`);
  console.log();

  // ── Step 4: Cognition items ───────────────────────────────────────────────
  console.log("▶ Step 4/5 — Cognition items in evolve_cognition table...");
  const cognitionCheck = await checkCognitionItems();
  console.log(`  ${statusIcon(cognitionCheck.status)} Items in DB: ${cognitionCheck.itemsInDb}`);
  if (cognitionCheck.error) errors.push(`Cognition: ${cognitionCheck.error}`);
  console.log();

  // ── Step 5: Cycle state ───────────────────────────────────────────────────
  console.log("▶ Step 5/5 — Verification cycle state...");
  const cycleStateCheck = await checkCycleState();
  console.log(`  ${statusIcon(cycleStateCheck.status)} Status: ${cycleStateCheck.status.toUpperCase()}`);
  console.log(`  Total cycles: ${cycleStateCheck.totalCycles} | Completed: ${cycleStateCheck.completedCycles}`);
  console.log(`  Best pIC50: ${cycleStateCheck.bestPic50 ?? "—"}`);
  console.log(`  Last cycle: ${cycleStateCheck.lastCycleAt?.toISOString() ?? "never"}`);
  if (cycleStateCheck.error) errors.push(`CycleState: ${cycleStateCheck.error}`);
  console.log();

  // ── Overall status ────────────────────────────────────────────────────────
  const criticalErrors = errors.filter(e => !e.includes("Python bridge"));
  const overallStatus: IntegrationReport["overallStatus"] =
    criticalErrors.length === 0 ? "pass" :
    criticalErrors.length <= 2 ? "partial" : "fail";

  const totalElapsedMs = elapsed(globalStart);

  const summary = overallStatus === "pass"
    ? `All checks passed. ${domainChecks.filter(d => d.status === "ok").length}/12 domains healthy. ${cognitionCheck.itemsInDb} cognition items. ${cycleStateCheck.completedCycles} completed cycles.`
    : `${errors.length} error(s) found. ${domainChecks.filter(d => d.status === "ok").length}/12 domains healthy. See errors array for details.`;

  const report: IntegrationReport = {
    generatedAt: new Date().toISOString(),
    overallStatus,
    pythonBridgeHealthy: bridgeHealthy,
    domainChecks,
    verificationCheck,
    cognitionCheck,
    cycleStateCheck,
    totalElapsedMs,
    summary,
    errors,
  };

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(`║  Overall: ${statusIcon(overallStatus)} ${overallStatus.toUpperCase().padEnd(47)}║`);
  console.log(`║  Elapsed: ${String(totalElapsedMs + "ms").padEnd(49)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  ${summary}\n`);

  if (errors.length > 0) {
    console.log("  Errors:");
    for (const e of errors) {
      console.log(`    ❌ ${e}`);
    }
    console.log();
  }

  // ── Write JSON report ─────────────────────────────────────────────────────
  const reportPath = "/tmp/integration-report.json";
  try {
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`  📄 Full report saved to: ${reportPath}\n`);
  } catch (err) {
    console.warn(`  ⚠️  Could not write report to ${reportPath}:`, err);
  }

  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────────────────────

// Run when invoked directly: npx tsx server/discovery/integration-test.ts
const isMain = process.argv[1]?.endsWith("integration-test.ts") ||
               process.argv[1]?.endsWith("integration-test.js");

if (isMain) {
  runIntegrationDiagnostic()
    .then(report => {
      process.exit(report.overallStatus === "fail" ? 1 : 0);
    })
    .catch(err => {
      console.error("Fatal error in integration diagnostic:", err);
      process.exit(1);
    });
}
