/**
 * query-evolver.ts
 *
 * Produces a more targeted HIV protease inhibitor discovery query by synthesising
 * three sources of evidence from the previous cycle:
 *
 *   1. Analyzer lessons  — free-text insights from the ASI-Evolve Analyzer agent
 *   2. Supported claims  — natural-language claims verified by citation.manus.space
 *   3. Contradicted claims — claims that were refuted by citation.manus.space
 *
 * The core function `evolveDiscoveryQuery()` calls the LLM with a structured
 * prompt and returns a single refined query string.  If the LLM is unavailable
 * the function falls back to a deterministic rule-based query builder so the
 * discovery loop never stalls.
 *
 * Design principles:
 *   - Pure function signature: all inputs explicit, no module-level state
 *   - LLM call is isolated behind a thin wrapper so tests can mock it
 *   - Fallback is always deterministic given the same inputs
 *   - Max query length is capped at MAX_QUERY_LENGTH to stay within python-bridge limits
 *
 * Source of truth: https://github.com/Gudmundur76/ttruthdesk-platform
 */

import { invokeLLM } from "../_core/llm";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum length of the returned query string (python-bridge limit). */
export const MAX_QUERY_LENGTH = 512;

/**
 * Baseline query used as the seed for the very first cycle and as the
 * ultimate fallback when all other strategies fail.
 */
export const BASELINE_QUERY =
  "HIV-1 protease inhibitor small molecule binding affinity pIC50 scaffold design";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured result returned by `evolveDiscoveryQuery()`.
 * The `query` field is the primary output; the other fields provide
 * provenance for logging and tRPC exposure.
 */
export interface EvolvedQuery {
  /** The refined discovery query to use in the next cycle. */
  query: string;
  /** Whether the query was produced by the LLM (true) or the fallback (false). */
  llmGenerated: boolean;
  /** Reasoning summary from the LLM, or a brief fallback description. */
  rationale: string;
  /** Key themes extracted from supported claims that shaped the query. */
  supportedThemes: string[];
  /** Key themes extracted from contradicted claims that were excluded. */
  excludedThemes: string[];
  /** ISO 8601 timestamp of when this query was generated. */
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the most salient chemical theme from a claim string.
 * Returns a short phrase (≤ 40 chars) suitable for inclusion in a query.
 *
 * Strategy: take the first noun phrase that contains a scaffold keyword,
 * otherwise return the first 40 chars of the claim.
 */
function extractTheme(claim: string): string {
  const scaffoldKeywords = [
    "bis-THF", "cyclic urea", "dihydropyrone", "hydroxyethylamine",
    "sulfonamide", "peptidomimetic", "macrocyclic", "fragment",
    "tipranavir", "darunavir", "lopinavir", "saquinavir", "indinavir",
    "P2 group", "P1' pocket", "S1 pocket", "flap region",
    "pIC50", "IC50", "Ki", "SMILES",
  ];

  const lower = claim.toLowerCase();
  for (const kw of scaffoldKeywords) {
    if (lower.includes(kw.toLowerCase())) {
      // Return the keyword itself as the theme
      return kw.slice(0, 40);
    }
  }

  // Fallback: first 40 chars stripped of brackets
  return claim.replace(/^\[.*?\]\s*/, "").slice(0, 40).trim();
}

/**
 * Deterministic fallback query builder.
 *
 * Incorporates supported themes as positive terms and contradicted themes
 * as explicit exclusions.  Falls back gracefully when inputs are empty.
 */
export function buildFallbackQuery(
  previousQuery: string,
  lessons: string[],
  supportedClaims: string[],
  contradictedClaims: string[]
): string {
  const supportedThemes = supportedClaims
    .slice(0, 3)
    .map(extractTheme)
    .filter(Boolean);

  const contradictedThemes = contradictedClaims
    .slice(0, 2)
    .map(extractTheme)
    .filter(Boolean);

  // Extract any lesson that mentions a scaffold or modification
  const lessonHint = lessons
    .slice(0, 3)
    .map((l) => extractTheme(l))
    .filter(Boolean)
    .slice(0, 1)
    .join(" ");

  // Build the positive part
  const positiveParts: string[] = [
    "HIV-1 protease inhibitor",
    ...supportedThemes,
    lessonHint,
    "binding affinity pIC50",
    "novel scaffold",
  ].filter(Boolean);

  // Build the exclusion part
  const exclusionParts = contradictedThemes.map((t) => `NOT "${t}"`);

  const combined = [...positiveParts, ...exclusionParts].join(" ");

  return combined.slice(0, MAX_QUERY_LENGTH).trim() || BASELINE_QUERY;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM prompt construction
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return (
    "You are an expert computational chemist and drug discovery researcher specialising in " +
    "HIV-1 protease inhibitors. You generate precise, targeted database search queries that " +
    "maximise the retrieval of novel, high-potency small molecule candidates. " +
    "Always respond with valid JSON only — no markdown, no code blocks."
  );
}

function buildUserPrompt(
  previousQuery: string,
  lessons: string[],
  supportedClaims: string[],
  contradictedClaims: string[]
): string {
  const lessonsBlock =
    lessons.length > 0
      ? lessons
          .slice(0, 5)
          .map((l, i) => `${i + 1}. ${l.slice(0, 300)}`)
          .join("\n")
      : "No lessons available yet.";

  const supportedBlock =
    supportedClaims.length > 0
      ? supportedClaims
          .slice(0, 5)
          .map((c, i) => `${i + 1}. ${c.slice(0, 200)}`)
          .join("\n")
      : "No supported claims yet.";

  const contradictedBlock =
    contradictedClaims.length > 0
      ? contradictedClaims
          .slice(0, 5)
          .map((c, i) => `${i + 1}. ${c.slice(0, 200)}`)
          .join("\n")
      : "No contradicted claims yet.";

  return `## Task
Generate a refined discovery query for the next HIV-1 protease inhibitor search cycle.
The query will be submitted to a multi-source scientific database engine (ChEMBL, PubChem,
PDB, BindingDB, UniProt) to retrieve candidate SMILES and binding data.

## Previous Query
${previousQuery}

## Analyzer Lessons (from the last cycle)
${lessonsBlock}

## Citation-Verified Claims (confirmed by literature)
${supportedBlock}

## Contradicted Claims (refuted by literature — avoid these)
${contradictedBlock}

## Requirements for the New Query
1. Build on verified structural insights from supported claims
2. Explicitly avoid scaffold families or mechanisms from contradicted claims
3. Incorporate the most actionable lesson from the Analyzer
4. Be specific: name scaffolds, substituents, binding pockets, or assay types
5. Keep the query under ${MAX_QUERY_LENGTH} characters
6. The query must be more targeted than the previous query — not a generic restatement

## Response Format (strict JSON, no markdown)
{
  "query": "the refined search query string",
  "rationale": "2-3 sentences explaining why this query is more targeted",
  "supported_themes": ["theme1", "theme2"],
  "excluded_themes": ["theme1", "theme2"]
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evolve the discovery query for the next cycle.
 *
 * Synthesises Analyzer lessons and citation verdicts into a more targeted
 * search query using an LLM.  Falls back to a deterministic rule-based
 * builder if the LLM is unavailable or returns an unusable response.
 *
 * @param previousQuery      The query used in the most recent discovery cycle
 * @param lessons            Free-text lessons from the ASI-Evolve Analyzer agent
 * @param supportedClaims    Natural-language claims verified by citation.manus.space
 * @param contradictedClaims Natural-language claims refuted by citation.manus.space
 * @returns                  EvolvedQuery with the refined query and provenance metadata
 */
export async function evolveDiscoveryQuery(
  previousQuery: string,
  lessons: string[],
  supportedClaims: string[],
  contradictedClaims: string[]
): Promise<EvolvedQuery> {
  const generatedAt = new Date().toISOString();

  // Guard: treat empty/whitespace-only previousQuery as baseline
  const effectivePreviousQuery =
    previousQuery.trim().length > 0 ? previousQuery.trim() : BASELINE_QUERY;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildUserPrompt(
            effectivePreviousQuery,
            lessons,
            supportedClaims,
            contradictedClaims
          ),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "evolved_query",
          strict: true,
          schema: {
            type: "object",
            properties: {
              query: { type: "string" },
              rationale: { type: "string" },
              supported_themes: { type: "array", items: { type: "string" } },
              excluded_themes: { type: "array", items: { type: "string" } },
            },
            required: ["query", "rationale", "supported_themes", "excluded_themes"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty LLM response");

    const content =
      typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = JSON.parse(content);

    const query = (parsed.query as string | undefined)?.trim();
    if (!query || query.length < 10) {
      throw new Error(`LLM returned unusable query: "${query}"`);
    }

    const truncatedQuery = query.slice(0, MAX_QUERY_LENGTH);
    const supportedThemes: string[] = (parsed.supported_themes as string[] | undefined) ?? [];
    const excludedThemes: string[] = (parsed.excluded_themes as string[] | undefined) ?? [];

    console.log(
      `[QueryEvolver] LLM query evolved: "${effectivePreviousQuery.slice(0, 60)}..." ` +
        `→ "${truncatedQuery.slice(0, 60)}..." ` +
        `(+${supportedThemes.length} themes, -${excludedThemes.length} excluded)`
    );

    return {
      query: truncatedQuery,
      llmGenerated: true,
      rationale: (parsed.rationale as string | undefined)?.slice(0, 500) ?? "",
      supportedThemes,
      excludedThemes,
      generatedAt,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[QueryEvolver] LLM failed (${reason}), using fallback`);

    const fallbackQuery = buildFallbackQuery(
      effectivePreviousQuery,
      lessons,
      supportedClaims,
      contradictedClaims
    );

    const supportedThemes = supportedClaims.slice(0, 3).map(extractTheme).filter(Boolean);
    const excludedThemes = contradictedClaims.slice(0, 2).map(extractTheme).filter(Boolean);

    return {
      query: fallbackQuery,
      llmGenerated: false,
      rationale: `Fallback: deterministic query built from ${supportedClaims.length} supported and ${contradictedClaims.length} contradicted claims. LLM error: ${reason.slice(0, 120)}`,
      supportedThemes,
      excludedThemes,
      generatedAt,
    };
  }
}
