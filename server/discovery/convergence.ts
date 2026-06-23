/**
 * Convergence Detector — TypeScript port of convergence_detector.py
 *
 * From day 7 onwards, detects molecules that appear as high-scorers in
 * multiple tracks (cross-track consensus). Convergence candidates are
 * priority molecules for the day-30 peer-reviewable publication.
 *
 * A molecule is a convergence candidate if:
 *   1. It appears in ≥ 2 tracks (by Tanimoto similarity ≥ 0.7)
 *   2. Its predicted pIC50 ≥ 8.0 in all tracks where it appears
 *   3. Its ensemble std ≤ 0.3 (high model agreement)
 */

import { generateFingerprint, tanimotoFromBits } from "./chemistry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackResult {
  track: "A" | "B" | "C" | "D";
  smiles: string;
  pic50: number;
  ensembleStd: number;
  confidence: number;
}

export interface ConvergenceCandidate {
  smiles: string;
  tracks: Array<"A" | "B" | "C" | "D">;
  meanPic50: number;
  maxPic50: number;
  minEnsembleStd: number;
  convergenceScore: number; // 0–1, higher = more convergent
  trackResults: TrackResult[];
}

export interface ConvergenceReport {
  cycleNumber: number;
  dayNumber: number;
  totalCandidates: number;
  convergenceCandidates: ConvergenceCandidate[];
  bestCandidate: ConvergenceCandidate | null;
  analysisTimestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CONVERGENCE_TANIMOTO_THRESHOLD = 0.7;
const CONVERGENCE_PIC50_THRESHOLD = 8.0;
const CONVERGENCE_STD_THRESHOLD = 0.3;
const MIN_TRACKS_FOR_CONVERGENCE = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Convergence detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect convergence candidates from a set of track results.
 * Groups similar molecules across tracks and identifies those meeting
 * the convergence criteria.
 */
export async function detectConvergence(
  trackResults: TrackResult[],
  cycleNumber: number,
  dayNumber: number
): Promise<ConvergenceReport> {
  // Pre-compute fingerprints for all results
  const fpMap = new Map<string, number[]>();
  for (const result of trackResults) {
    const fp = await generateFingerprint(result.smiles);
    if (fp) {
      fpMap.set(result.smiles, fp.fingerprintBits);
    }
  }

  // Group similar molecules across tracks
  const groups: Map<string, TrackResult[]> = new Map();
  const assigned = new Set<string>();

  for (const result of trackResults) {
    if (assigned.has(result.smiles)) continue;
    const group: TrackResult[] = [result];
    assigned.add(result.smiles);

    const fp1 = fpMap.get(result.smiles);
    if (!fp1) continue;

    for (const other of trackResults) {
      if (assigned.has(other.smiles)) continue;
      if (other.track === result.track) continue; // Different tracks only

      const fp2 = fpMap.get(other.smiles);
      if (!fp2) continue;

      const sim = tanimotoFromBits(fp1, fp2);
      if (sim >= CONVERGENCE_TANIMOTO_THRESHOLD) {
        group.push(other);
        assigned.add(other.smiles);
      }
    }

    if (group.length >= MIN_TRACKS_FOR_CONVERGENCE) {
      groups.set(result.smiles, group);
    }
  }

  // Build convergence candidates from groups
  const convergenceCandidates: ConvergenceCandidate[] = [];

  for (const [representativeSmiles, group] of Array.from(groups.entries())) {
    const tracks = Array.from(new Set(group.map((r: TrackResult) => r.track))) as Array<"A" | "B" | "C" | "D">;

    // Check convergence criteria
    const allHighPic50 = group.every((r: TrackResult) => r.pic50 >= CONVERGENCE_PIC50_THRESHOLD);
    const allLowStd = group.every((r: TrackResult) => r.ensembleStd <= CONVERGENCE_STD_THRESHOLD);

    if (!allHighPic50 || !allLowStd) continue;

    const meanPic50 = group.reduce((sum: number, r: TrackResult) => sum + r.pic50, 0) / group.length;
    const maxPic50 = Math.max(...group.map((r: TrackResult) => r.pic50));
    const minEnsembleStd = Math.min(...group.map((r: TrackResult) => r.ensembleStd));

    // Convergence score: weighted by number of tracks, pIC50, and model agreement
    const trackScore = tracks.length / 4; // 0.25–1.0
    const pic50Score = Math.min(1.0, (meanPic50 - 7) / 4); // 0–1 for pIC50 7–11
    const stdScore = 1 - minEnsembleStd / CONVERGENCE_STD_THRESHOLD; // 0–1
    const convergenceScore =
      0.4 * trackScore + 0.4 * pic50Score + 0.2 * stdScore;

    convergenceCandidates.push({
      smiles: representativeSmiles,
      tracks,
      meanPic50: Math.round(meanPic50 * 1000) / 1000,
      maxPic50: Math.round(maxPic50 * 1000) / 1000,
      minEnsembleStd: Math.round(minEnsembleStd * 1000) / 1000,
      convergenceScore: Math.round(convergenceScore * 1000) / 1000,
      trackResults: group,
    });
  }

  // Sort by convergence score (descending)
  convergenceCandidates.sort((a, b) => b.convergenceScore - a.convergenceScore);

  const bestCandidate = convergenceCandidates[0] || null;

  console.log(
    `[Convergence] Cycle ${cycleNumber}, Day ${dayNumber}: ` +
    `${convergenceCandidates.length} convergence candidates from ${trackResults.length} total`
  );

  return {
    cycleNumber,
    dayNumber,
    totalCandidates: trackResults.length,
    convergenceCandidates,
    bestCandidate,
    analysisTimestamp: new Date().toISOString(),
  };
}

/**
 * Check if convergence analysis should run for this day.
 * Per the Python engine: convergence starts from day 7.
 */
export function shouldRunConvergence(dayNumber: number): boolean {
  return dayNumber >= 7;
}

/**
 * Format a convergence report as a human-readable summary.
 */
export function formatConvergenceReport(report: ConvergenceReport): string {
  if (report.convergenceCandidates.length === 0) {
    return `Day ${report.dayNumber}, Cycle ${report.cycleNumber}: No convergence candidates yet.`;
  }

  const lines = [
    `=== Convergence Report — Day ${report.dayNumber}, Cycle ${report.cycleNumber} ===`,
    `Total candidates analysed: ${report.totalCandidates}`,
    `Convergence candidates: ${report.convergenceCandidates.length}`,
    "",
  ];

  for (let i = 0; i < Math.min(5, report.convergenceCandidates.length); i++) {
    const c = report.convergenceCandidates[i];
    lines.push(
      `[${i + 1}] Tracks: ${c.tracks.join("+")} | pIC50: ${c.meanPic50.toFixed(2)} | ` +
      `Score: ${c.convergenceScore.toFixed(3)} | SMILES: ${c.smiles.substring(0, 40)}...`
    );
  }

  if (report.bestCandidate) {
    lines.push("", `★ Best: ${report.bestCandidate.smiles.substring(0, 60)}`);
    lines.push(`  pIC50=${report.bestCandidate.meanPic50.toFixed(2)}, tracks=${report.bestCandidate.tracks.join("+")}`);
  }

  return lines.join("\n");
}
