/**
 * query-evolver.test.ts
 *
 * Unit tests for evolveDiscoveryQuery() and buildFallbackQuery().
 * All LLM calls are mocked — no real network requests.
 *
 * Test plan:
 *   1.  buildFallbackQuery — empty inputs returns baseline-like query
 *   2.  buildFallbackQuery — supported claims incorporated as positive terms
 *   3.  buildFallbackQuery — contradicted claims appear as NOT exclusions
 *   4.  buildFallbackQuery — lessons contribute a theme hint
 *   5.  buildFallbackQuery — output never exceeds MAX_QUERY_LENGTH
 *   6.  evolveDiscoveryQuery — LLM path: returns llmGenerated=true with query
 *   7.  evolveDiscoveryQuery — LLM path: supported/excluded themes populated
 *   8.  evolveDiscoveryQuery — LLM path: query truncated to MAX_QUERY_LENGTH
 *   9.  evolveDiscoveryQuery — LLM returns empty query → fallback triggered
 *  10.  evolveDiscoveryQuery — LLM returns null content → fallback triggered
 *  11.  evolveDiscoveryQuery — LLM throws → fallback triggered, llmGenerated=false
 *  12.  evolveDiscoveryQuery — empty previousQuery uses BASELINE_QUERY
 *  13.  evolveDiscoveryQuery — all inputs empty → returns a valid query
 *  14.  evolveDiscoveryQuery — generatedAt is a valid ISO 8601 timestamp
 *  15.  evolveDiscoveryQuery — rationale is populated in both LLM and fallback paths
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evolveDiscoveryQuery,
  buildFallbackQuery,
  BASELINE_QUERY,
  MAX_QUERY_LENGTH,
} from "./query-evolver";

// ── Mock invokeLLM ────────────────────────────────────────────────────────────

const mockInvokeLLM = vi.fn();

vi.mock("../_core/llm", () => ({
  invokeLLM: (...args: any[]) => mockInvokeLLM(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLLMResponse(query: string, rationale = "Test rationale", supportedThemes: string[] = [], excludedThemes: string[] = []) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({ query, rationale, supported_themes: supportedThemes, excluded_themes: excludedThemes }),
        },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildFallbackQuery tests
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFallbackQuery", () => {
  it("returns a non-empty query when all inputs are empty", () => {
    const result = buildFallbackQuery("", [], [], []);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("HIV");
  });

  it("incorporates supported claim themes as positive terms", () => {
    const result = buildFallbackQuery(
      "HIV protease",
      [],
      ["Compound X shows pIC50=8.5 with bis-THF scaffold against HIV-1 protease"],
      []
    );
    expect(result.toLowerCase()).toContain("bis-thf");
  });

  it("incorporates contradicted claim themes as NOT exclusions", () => {
    const result = buildFallbackQuery(
      "HIV protease",
      [],
      [],
      ["Cyclic urea scaffold shows no activity against HIV-1 protease"]
    );
    expect(result).toContain("NOT");
    expect(result.toLowerCase()).toContain("cyclic urea");
  });

  it("incorporates a lesson hint when lessons contain scaffold keywords", () => {
    const result = buildFallbackQuery(
      "HIV protease",
      ["The darunavir scaffold with P2 group modifications improved pIC50 by 0.5"],
      [],
      []
    );
    // Should contain a theme from the lesson
    expect(result.length).toBeGreaterThan(20);
    expect(result).toContain("HIV");
  });

  it("never exceeds MAX_QUERY_LENGTH", () => {
    const longClaims = Array.from({ length: 20 }, (_, i) =>
      `Compound ${i} shows pIC50=${8 + i * 0.1} with bis-THF scaffold against HIV-1 protease inhibitor binding affinity`
    );
    const result = buildFallbackQuery("HIV protease", longClaims, longClaims, longClaims);
    expect(result.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
  });

  it("uses baseline query when previousQuery is empty and no claims exist", () => {
    const result = buildFallbackQuery("", [], [], []);
    // Should contain core HIV protease terms
    expect(result.toLowerCase()).toContain("hiv");
    expect(result.toLowerCase()).toContain("protease");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// evolveDiscoveryQuery — LLM success path
// ─────────────────────────────────────────────────────────────────────────────

describe("evolveDiscoveryQuery / LLM success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns llmGenerated=true when LLM succeeds", async () => {
    mockInvokeLLM.mockResolvedValue(
      makeLLMResponse(
        "HIV-1 protease inhibitor bis-THF P2 scaffold novel binding affinity",
        "Focused on bis-THF based on verified claims.",
        ["bis-THF"],
        []
      )
    );

    const result = await evolveDiscoveryQuery(
      "HIV protease inhibitor",
      ["bis-THF scaffold improved pIC50"],
      ["Compound X with bis-THF shows pIC50=8.5"],
      []
    );

    expect(result.llmGenerated).toBe(true);
    expect(result.query).toContain("bis-THF");
  });

  it("populates supportedThemes and excludedThemes from LLM response", async () => {
    mockInvokeLLM.mockResolvedValue(
      makeLLMResponse(
        "HIV-1 protease bis-THF scaffold NOT cyclic urea",
        "Rationale text",
        ["bis-THF", "P2 group"],
        ["cyclic urea"]
      )
    );

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(result.supportedThemes).toEqual(["bis-THF", "P2 group"]);
    expect(result.excludedThemes).toEqual(["cyclic urea"]);
  });

  it("truncates query to MAX_QUERY_LENGTH even when LLM returns a long string", async () => {
    const longQuery = "HIV-1 protease " + "inhibitor ".repeat(100);
    mockInvokeLLM.mockResolvedValue(makeLLMResponse(longQuery, "Rationale"));

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(result.query.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
    expect(result.llmGenerated).toBe(true);
  });

  it("populates rationale from LLM response", async () => {
    mockInvokeLLM.mockResolvedValue(
      makeLLMResponse("HIV-1 protease bis-THF", "This is the rationale from LLM.")
    );

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(result.rationale).toBe("This is the rationale from LLM.");
  });

  it("passes all four inputs to invokeLLM", async () => {
    mockInvokeLLM.mockResolvedValue(makeLLMResponse("HIV-1 protease inhibitor"));

    await evolveDiscoveryQuery(
      "previous query",
      ["lesson one"],
      ["supported claim one"],
      ["contradicted claim one"]
    );

    expect(mockInvokeLLM).toHaveBeenCalledOnce();
    const callArg = mockInvokeLLM.mock.calls[0][0];
    const userContent = callArg.messages.find((m: any) => m.role === "user")?.content ?? "";
    expect(userContent).toContain("previous query");
    expect(userContent).toContain("lesson one");
    expect(userContent).toContain("supported claim one");
    expect(userContent).toContain("contradicted claim one");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// evolveDiscoveryQuery — fallback paths
// ─────────────────────────────────────────────────────────────────────────────

describe("evolveDiscoveryQuery / fallback paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back when LLM returns an empty query string", async () => {
    mockInvokeLLM.mockResolvedValue(makeLLMResponse("   ", "Rationale"));

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(result.llmGenerated).toBe(false);
    expect(result.query.length).toBeGreaterThan(0);
  });

  it("falls back when LLM returns null content", async () => {
    mockInvokeLLM.mockResolvedValue({ choices: [{ message: { content: null } }] });

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(result.llmGenerated).toBe(false);
    expect(result.query.length).toBeGreaterThan(0);
  });

  it("falls back when LLM throws an error", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("Network timeout"));

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(result.llmGenerated).toBe(false);
    expect(result.rationale).toContain("Network timeout");
  });

  it("falls back when LLM returns invalid JSON", async () => {
    mockInvokeLLM.mockResolvedValue({
      choices: [{ message: { content: "not valid json {{" } }],
    });

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(result.llmGenerated).toBe(false);
    expect(result.query.length).toBeGreaterThan(0);
  });

  it("uses BASELINE_QUERY when previousQuery is empty or whitespace-only", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("LLM down"));

    const result = await evolveDiscoveryQuery("   ", [], [], []);

    // Fallback should produce a query that includes HIV terms
    expect(result.query.toLowerCase()).toContain("hiv");
    expect(result.llmGenerated).toBe(false);
  });

  it("returns a valid query even when all inputs are empty strings", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("LLM down"));

    const result = await evolveDiscoveryQuery("", [], [], []);

    expect(result.query.length).toBeGreaterThan(0);
    expect(result.query.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
  });

  it("fallback rationale mentions the LLM error", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("Service unavailable"));

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(result.rationale).toContain("Service unavailable");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// evolveDiscoveryQuery — output shape invariants
// ─────────────────────────────────────────────────────────────────────────────

describe("evolveDiscoveryQuery / output invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generatedAt is a valid ISO 8601 timestamp", async () => {
    mockInvokeLLM.mockResolvedValue(makeLLMResponse("HIV-1 protease bis-THF"));

    const before = new Date().toISOString();
    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);
    const after = new Date().toISOString();

    expect(result.generatedAt >= before).toBe(true);
    expect(result.generatedAt <= after).toBe(true);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("query is always a non-empty string", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("down"));

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(typeof result.query).toBe("string");
    expect(result.query.trim().length).toBeGreaterThan(0);
  });

  it("supportedThemes and excludedThemes are always arrays", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("down"));

    const result = await evolveDiscoveryQuery("HIV protease", [], [], []);

    expect(Array.isArray(result.supportedThemes)).toBe(true);
    expect(Array.isArray(result.excludedThemes)).toBe(true);
  });

  it("query never exceeds MAX_QUERY_LENGTH in any path", async () => {
    // LLM path with long response
    mockInvokeLLM.mockResolvedValue(makeLLMResponse("X".repeat(1000)));
    const r1 = await evolveDiscoveryQuery("HIV protease", [], [], []);
    expect(r1.query.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);

    // Fallback path
    mockInvokeLLM.mockRejectedValue(new Error("down"));
    const longClaims = Array.from({ length: 10 }, () => "bis-THF scaffold pIC50 HIV protease inhibitor binding affinity");
    const r2 = await evolveDiscoveryQuery("HIV protease", longClaims, longClaims, longClaims);
    expect(r2.query.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
  });
});
