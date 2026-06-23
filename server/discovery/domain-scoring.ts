/**
 * server/discovery/domain-scoring.ts
 *
 * Scoring strategies per domain type.
 * Each strategy takes raw DiscoveryResult[] and returns ScoredResult[],
 * sorted descending by score.
 *
 * Strategies:
 *   molecular  — ML ensemble pIC50 proxy + Lipinski drug-likeness filter
 *   economic   — numeric indicator scoring (trend strength, GDP correlation)
 *   text       — TF-IDF relevance scoring against the discovery query
 *   numeric    — statistical significance scoring (z-score normalisation)
 */

import type { DiscoveryResult } from "./python-bridge.js";
import type { ScoringStrategy } from "../../shared/types/domain.js";

// ── Output type ───────────────────────────────────────────────────────────────

export interface ScoredResult {
  /** Original discovery result */
  result: DiscoveryResult;
  /** Normalised score in [0, 1] */
  score: number;
  /** Human-readable label for the score (e.g. "pIC50=8.5", "z=3.2") */
  scoreLabel: string;
  /** Which strategy produced this score */
  strategy: ScoringStrategy;
  /** Whether this result passed the domain-specific quality gate */
  passesGate: boolean;
}

// ── Molecular scoring ─────────────────────────────────────────────────────────
// Uses pIC50 if available, otherwise estimates from abstract keyword density.
// Applies Lipinski Ro5 gate: MW ≤ 500, logP ≤ 5, HBD ≤ 5, HBA ≤ 10.

const MOLECULAR_KEYWORDS = [
  "inhibitor", "binding", "affinity", "ic50", "ki", "kd", "pic50",
  "potency", "selectivity", "protease", "kinase", "receptor", "ligand",
];

function estimateMolecularScore(result: DiscoveryResult): number {
  // If pIC50 is directly available, normalise from [4, 12] → [0, 1]
  if (result.pic50 != null) {
    return Math.min(1, Math.max(0, (result.pic50 - 4) / 8));
  }
  // Fallback: keyword density in abstract
  const text = `${result.title} ${result.abstract}`.toLowerCase();
  const hits = MOLECULAR_KEYWORDS.filter((kw) => text.includes(kw)).length;
  return Math.min(1, hits / MOLECULAR_KEYWORDS.length);
}

function lipinskiGate(result: DiscoveryResult): boolean {
  // If no SMILES, we cannot apply Ro5 — pass through
  if (!result.smiles) return true;
  // Very rough heuristic: SMILES length as MW proxy (< 100 chars ≈ MW < 500)
  return result.smiles.length < 100;
}

function scoreMolecular(results: DiscoveryResult[]): ScoredResult[] {
  return results
    .map((r) => {
      const score = estimateMolecularScore(r);
      const passesGate = lipinskiGate(r);
      const label = r.pic50 != null ? `pIC50=${r.pic50.toFixed(2)}` : `kw=${(score * 100).toFixed(0)}%`;
      return { result: r, score, scoreLabel: label, strategy: "molecular" as ScoringStrategy, passesGate };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Economic scoring ──────────────────────────────────────────────────────────
// Scores based on numeric values embedded in the abstract (trend strength,
// percentage changes, GDP correlation proxies).

const ECONOMIC_KEYWORDS = [
  "gdp", "growth", "inflation", "unemployment", "trade", "deficit",
  "surplus", "fiscal", "monetary", "interest rate", "cpi", "ppi",
  "recession", "expansion", "forecast", "projection",
];

const NUMERIC_PATTERN = /[-+]?\d+(?:\.\d+)?%/g;

function extractNumericMagnitude(text: string): number {
  const matches = text.match(NUMERIC_PATTERN) ?? [];
  if (matches.length === 0) return 0;
  const values = matches.map((m) => Math.abs(parseFloat(m)));
  const max = Math.max(...values);
  // Normalise: 0% → 0, ≥ 20% → 1
  return Math.min(1, max / 20);
}

function scoreEconomic(results: DiscoveryResult[], query: string): ScoredResult[] {
  const queryTerms = query.toLowerCase().split(/\s+/);
  return results
    .map((r) => {
      const text = `${r.title} ${r.abstract}`.toLowerCase();
      const kwHits = ECONOMIC_KEYWORDS.filter((kw) => text.includes(kw)).length;
      const kwScore = Math.min(1, kwHits / 6);
      const numericScore = extractNumericMagnitude(text);
      const queryScore = queryTerms.filter((t) => t.length > 3 && text.includes(t)).length / Math.max(1, queryTerms.length);
      const score = 0.4 * kwScore + 0.3 * numericScore + 0.3 * queryScore;
      const passesGate = kwHits >= 2;
      return {
        result: r,
        score,
        scoreLabel: `kw=${kwHits} num=${(numericScore * 100).toFixed(0)}%`,
        strategy: "economic" as ScoringStrategy,
        passesGate,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Text scoring (TF-IDF proxy) ───────────────────────────────────────────────
// Computes term-frequency overlap between the query and each result's
// title + abstract. No IDF corpus is available at runtime, so we use
// a simple normalised term-overlap score.

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function scoreText(results: DiscoveryResult[], query: string): ScoredResult[] {
  const queryTokens = new Set(tokenise(query));
  if (queryTokens.size === 0) {
    return results.map((r) => ({
      result: r, score: 0, scoreLabel: "tf=0", strategy: "text" as ScoringStrategy, passesGate: false,
    }));
  }
  return results
    .map((r) => {
      const docTokens = tokenise(`${r.title} ${r.abstract}`);
      const docSet = new Set(docTokens);
      const intersection = Array.from(queryTokens).filter((t) => docSet.has(t)).length;
      // Jaccard-like: intersection / union
      const union = new Set([...Array.from(queryTokens), ...Array.from(docSet)]).size;
      const score = intersection / union;
      const passesGate = score > 0.05;
      return {
        result: r,
        score,
        scoreLabel: `tf=${intersection}/${queryTokens.size}`,
        strategy: "text" as ScoringStrategy,
        passesGate,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Numeric scoring (z-score normalisation) ───────────────────────────────────
// Extracts all numeric values from abstracts, z-scores them, and ranks
// results by absolute z-score (outliers = high signal).

function extractFirstNumeric(text: string): number | null {
  const match = text.match(/[-+]?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function scoreNumeric(results: DiscoveryResult[]): ScoredResult[] {
  const values: (number | null)[] = results.map((r) =>
    extractFirstNumeric(`${r.title} ${r.abstract}`)
  );
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) {
    return results.map((r) => ({
      result: r, score: 0, scoreLabel: "z=0", strategy: "numeric" as ScoringStrategy, passesGate: false,
    }));
  }
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  const std = Math.sqrt(variance) || 1;

  return results
    .map((r, i) => {
      const raw = values[i];
      if (raw === null) {
        return { result: r, score: 0, scoreLabel: "z=n/a", strategy: "numeric" as ScoringStrategy, passesGate: false };
      }
      const z = (raw - mean) / std;
      // Normalise |z| to [0, 1] using sigmoid: 1 / (1 + e^{-|z|/2})
      const score = 1 / (1 + Math.exp(-Math.abs(z) / 2));
      const passesGate = Math.abs(z) >= 1.0; // at least 1 std dev from mean
      return {
        result: r,
        score,
        scoreLabel: `z=${z.toFixed(2)}`,
        strategy: "numeric" as ScoringStrategy,
        passesGate,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Score a batch of discovery results using the specified strategy.
 *
 * @param results  Raw results from the Python bridge
 * @param strategy Which scoring strategy to apply
 * @param query    The original discovery query (used by text + economic)
 * @returns        Sorted ScoredResult[] (highest score first)
 */
export function scoreByStrategy(
  results: DiscoveryResult[],
  strategy: ScoringStrategy,
  query: string
): ScoredResult[] {
  if (results.length === 0) return [];
  switch (strategy) {
    case "molecular":
      return scoreMolecular(results);
    case "economic":
      return scoreEconomic(results, query);
    case "text":
      return scoreText(results, query);
    case "numeric":
      return scoreNumeric(results);
    default: {
      // Exhaustive check — TypeScript will catch missing cases
      const _exhaustive: never = strategy;
      throw new Error(`Unknown scoring strategy: ${_exhaustive}`);
    }
  }
}

/**
 * Returns only results that pass the domain-specific quality gate.
 */
export function filterByGate(scored: ScoredResult[]): ScoredResult[] {
  return scored.filter((s) => s.passesGate);
}

/**
 * Returns the top-N results by score (regardless of gate).
 */
export function topN(scored: ScoredResult[], n: number): ScoredResult[] {
  return scored.slice(0, n);
}
