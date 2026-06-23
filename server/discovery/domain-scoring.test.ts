/**
 * domain-scoring.test.ts
 *
 * Unit tests for the four scoring strategies in domain-scoring.ts.
 * Covers: molecular, economic, text, numeric — plus filterByGate and topN.
 */

import { describe, it, expect } from "vitest";
import {
  scoreByStrategy,
  filterByGate,
  topN,
  type ScoredResult,
} from "./domain-scoring.js";
import type { DiscoveryResult } from "./python-bridge.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
  return {
    id: "r1",
    title: "Test result",
    source: "pubchem",
    abstract: "A test abstract with some content.",
    ...overrides,
  };
}

// ── scoreByStrategy: molecular ────────────────────────────────────────────────

describe("scoreByStrategy / molecular", () => {
  it("returns empty array for empty input", () => {
    expect(scoreByStrategy([], "molecular", "query")).toEqual([]);
  });

  it("uses pIC50 directly when available and normalises to [0,1]", () => {
    const r = makeResult({ pic50: 8.0 }); // (8-4)/8 = 0.5
    const [scored] = scoreByStrategy([r], "molecular", "query");
    expect(scored.score).toBeCloseTo(0.5, 3);
    expect(scored.scoreLabel).toContain("pIC50=8.00");
    expect(scored.strategy).toBe("molecular");
  });

  it("clamps pIC50 score to [0,1] for extreme values", () => {
    const high = makeResult({ pic50: 20 }); // > 12 → 1
    const low  = makeResult({ pic50: 1 });  // < 4  → 0
    const results = scoreByStrategy([high, low], "molecular", "q");
    expect(results[0].score).toBe(1);
    expect(results[1].score).toBe(0);
  });

  it("falls back to keyword density when no pIC50", () => {
    const r = makeResult({
      abstract: "This inhibitor shows strong binding affinity and potency against the protease receptor.",
    });
    const [scored] = scoreByStrategy([r], "molecular", "query");
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.scoreLabel).toContain("kw=");
  });

  it("sorts results descending by score", () => {
    const high = makeResult({ id: "h", pic50: 9.5 });
    const low  = makeResult({ id: "l", pic50: 5.0 });
    const results = scoreByStrategy([low, high], "molecular", "q");
    expect(results[0].result.id).toBe("h");
    expect(results[1].result.id).toBe("l");
  });

  it("passes Lipinski gate for short SMILES", () => {
    const r = makeResult({ smiles: "CC(=O)Oc1ccccc1C(=O)O" }); // aspirin, 22 chars
    const [scored] = scoreByStrategy([r], "molecular", "q");
    expect(scored.passesGate).toBe(true);
  });

  it("fails Lipinski gate for very long SMILES (> 100 chars)", () => {
    const r = makeResult({ smiles: "C".repeat(101) });
    const [scored] = scoreByStrategy([r], "molecular", "q");
    expect(scored.passesGate).toBe(false);
  });
});

// ── scoreByStrategy: economic ─────────────────────────────────────────────────

describe("scoreByStrategy / economic", () => {
  it("returns empty array for empty input", () => {
    expect(scoreByStrategy([], "economic", "GDP growth")).toEqual([]);
  });

  it("scores higher for results with economic keywords and percentages", () => {
    const rich = makeResult({
      title: "GDP growth and inflation",
      abstract: "The GDP growth rate increased by 3.5% while inflation rose to 2.1%. Trade deficit widened.",
    });
    const poor = makeResult({
      title: "Random title",
      abstract: "Nothing relevant here at all.",
    });
    const results = scoreByStrategy([poor, rich], "economic", "GDP inflation");
    expect(results[0].result.id).toBe(rich.id);
  });

  it("passes gate when at least 2 economic keywords present", () => {
    const r = makeResult({
      abstract: "GDP growth and inflation are key monetary indicators.",
    });
    const [scored] = scoreByStrategy([r], "economic", "GDP");
    expect(scored.passesGate).toBe(true);
  });

  it("fails gate when fewer than 2 economic keywords", () => {
    const r = makeResult({ abstract: "Nothing economic here." });
    const [scored] = scoreByStrategy([r], "economic", "GDP");
    expect(scored.passesGate).toBe(false);
  });

  it("scoreLabel contains kw and num fields", () => {
    const r = makeResult({ abstract: "GDP grew by 5.2% due to fiscal expansion." });
    const [scored] = scoreByStrategy([r], "economic", "GDP");
    expect(scored.scoreLabel).toMatch(/kw=\d+ num=\d+%/);
  });
});

// ── scoreByStrategy: text ─────────────────────────────────────────────────────

describe("scoreByStrategy / text", () => {
  it("returns empty array for empty input", () => {
    expect(scoreByStrategy([], "text", "query")).toEqual([]);
  });

  it("scores 0 for all results when query is empty", () => {
    const r = makeResult({ abstract: "Some content here." });
    const results = scoreByStrategy([r], "text", "");
    expect(results[0].score).toBe(0);
  });

  it("higher overlap → higher score", () => {
    const high = makeResult({
      id: "h",
      title: "Climate change carbon emissions",
      abstract: "Carbon emissions drive climate change temperature rise.",
    });
    const low = makeResult({
      id: "l",
      title: "Unrelated topic",
      abstract: "Nothing to do with the query.",
    });
    const results = scoreByStrategy([low, high], "text", "climate change carbon emissions temperature");
    expect(results[0].result.id).toBe("h");
  });

  it("passes gate when Jaccard score > 0.05", () => {
    const r = makeResult({
      abstract: "protein folding structure function prediction",
    });
    const [scored] = scoreByStrategy([r], "text", "protein folding structure");
    expect(scored.passesGate).toBe(true);
  });

  it("scoreLabel contains tf=N/M format", () => {
    const r = makeResult({ abstract: "protein folding" });
    const [scored] = scoreByStrategy([r], "text", "protein folding");
    expect(scored.scoreLabel).toMatch(/tf=\d+\/\d+/);
  });
});

// ── scoreByStrategy: numeric ──────────────────────────────────────────────────

describe("scoreByStrategy / numeric", () => {
  it("returns empty array for empty input", () => {
    expect(scoreByStrategy([], "numeric", "query")).toEqual([]);
  });

  it("scores 0 for all results when no numerics found", () => {
    const r = makeResult({ abstract: "No numbers here at all." });
    const [scored] = scoreByStrategy([r], "numeric", "q");
    expect(scored.score).toBe(0);
    expect(scored.passesGate).toBe(false);
  });

  it("outlier (high z-score) gets higher score than mean value", () => {
    const outlier = makeResult({ id: "out", abstract: "Temperature anomaly: 9999 degrees." });
    const normal  = makeResult({ id: "norm", abstract: "Temperature anomaly: 1 degree." });
    const baseline = makeResult({ id: "base", abstract: "Temperature anomaly: 2 degrees." });
    const results = scoreByStrategy([normal, baseline, outlier], "numeric", "temperature");
    expect(results[0].result.id).toBe("out");
  });

  it("passes gate when |z| >= 1.0", () => {
    // Create a clear outlier
    const outlier = makeResult({ id: "out", abstract: "Value: 1000000" });
    const r1 = makeResult({ id: "r1", abstract: "Value: 1" });
    const r2 = makeResult({ id: "r2", abstract: "Value: 2" });
    const results = scoreByStrategy([r1, r2, outlier], "numeric", "q");
    const outScored = results.find((s) => s.result.id === "out")!;
    expect(outScored.passesGate).toBe(true);
  });

  it("scoreLabel contains z= format", () => {
    const r = makeResult({ abstract: "Value: 42" });
    const [scored] = scoreByStrategy([r], "numeric", "q");
    expect(scored.scoreLabel).toMatch(/z=/);
  });
});

// ── filterByGate ──────────────────────────────────────────────────────────────

describe("filterByGate", () => {
  it("returns only results where passesGate is true", () => {
    const scored: ScoredResult[] = [
      { result: makeResult({ id: "a" }), score: 0.9, scoreLabel: "x", strategy: "text", passesGate: true },
      { result: makeResult({ id: "b" }), score: 0.1, scoreLabel: "y", strategy: "text", passesGate: false },
    ];
    const filtered = filterByGate(scored);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].result.id).toBe("a");
  });

  it("returns empty array when all fail gate", () => {
    const scored: ScoredResult[] = [
      { result: makeResult(), score: 0, scoreLabel: "", strategy: "numeric", passesGate: false },
    ];
    expect(filterByGate(scored)).toEqual([]);
  });
});

// ── topN ──────────────────────────────────────────────────────────────────────

describe("topN", () => {
  it("returns the first N results", () => {
    const scored: ScoredResult[] = Array.from({ length: 10 }, (_, i) => ({
      result: makeResult({ id: `r${i}` }),
      score: 1 - i * 0.1,
      scoreLabel: "",
      strategy: "text" as const,
      passesGate: true,
    }));
    expect(topN(scored, 3)).toHaveLength(3);
    expect(topN(scored, 3)[0].result.id).toBe("r0");
  });

  it("returns all results when N >= length", () => {
    const scored: ScoredResult[] = [
      { result: makeResult(), score: 1, scoreLabel: "", strategy: "molecular", passesGate: true },
    ];
    expect(topN(scored, 100)).toHaveLength(1);
  });
});
