/**
 * busWriter.ts — GitHub bus writer for notus-is discovery results.
 *
 * Publishes convergence candidates and best molecules to
 * manus-persistent-drive/bus/notus-is/results/ so that generic-signal-api
 * can read them without requiring direct HTTP between Manus services.
 *
 * This is the Priority 4 connection in the GitHub message bus architecture.
 * Works across sandbox hibernation cycles because the bus is a git repository.
 *
 * Output file format:
 * {
 *   "runId": <number>,
 *   "publishedAt": "<ISO>",
 *   "source": "notus-is",
 *   "target": "HIV-1 Protease",
 *   "convergenceCandidates": [...],
 *   "bestCandidate": { smiles, pic50, track, verified, citationVerdict }
 * }
 */

import * as fs from "fs";
import * as path from "path";

export interface BusCandidate {
  smiles: string;
  pic50: number;
  track: string;
  verified: boolean;
  citationVerdict?: string;
  citationConfidence?: number;
  verificationSources?: string[];
}

export interface NotusDiscoveryResult {
  runId: number;
  target: string;
  bestCandidate?: BusCandidate;
  convergenceCandidates: BusCandidate[];
  cycleScore: number;
  noveltySignal?: string;
}

/**
 * Write a discovery result to the GitHub bus.
 * Non-blocking — failures are silently logged.
 */
export function writeDiscoveryResultToBus(result: NotusDiscoveryResult): void {
  const busRepoPath =
    process.env.BUS_REPO_PATH ??
    path.join(__dirname, "../../../../manus-persistent-drive");
  const busDir = path.join(busRepoPath, "bus/notus-is/results");

  if (!fs.existsSync(busDir)) {
    // Bus not mounted — skip silently
    return;
  }

  try {
    const filename = `run_${result.runId}_${Date.now()}.json`;
    const busEntry = {
      runId: result.runId,
      publishedAt: new Date().toISOString(),
      source: "notus-is",
      target: result.target,
      bestCandidate: result.bestCandidate ?? null,
      convergenceCandidates: result.convergenceCandidates,
      cycleScore: result.cycleScore,
      noveltySignal: result.noveltySignal ?? null,
    };

    fs.writeFileSync(
      path.join(busDir, filename),
      JSON.stringify(busEntry, null, 2),
      "utf8"
    );

    console.log(
      `[BusWriter] Discovery result for run ${result.runId} written to bus: ${filename}`
    );
  } catch (err) {
    console.warn(
      `[BusWriter] Failed to write discovery result to bus (non-fatal):`,
      err
    );
  }
}

/**
 * Read the latest discovery result from the bus.
 * Used by generic-signal-api to get the best notus-is candidate.
 */
export function readLatestDiscoveryResultFromBus(
  busRepoPath?: string
): NotusDiscoveryResult | null {
  const repoPath =
    busRepoPath ??
    process.env.BUS_REPO_PATH ??
    path.join(__dirname, "../../../../manus-persistent-drive");
  const busDir = path.join(repoPath, "bus/notus-is/results");

  if (!fs.existsSync(busDir)) return null;

  try {
    const files = fs
      .readdirSync(busDir)
      .filter((f) => f.endsWith(".json") && !f.startsWith("."))
      .sort()
      .reverse(); // newest first

    if (files.length === 0) return null;

    const latest = fs.readFileSync(path.join(busDir, files[0]), "utf8");
    return JSON.parse(latest) as NotusDiscoveryResult;
  } catch {
    return null;
  }
}
