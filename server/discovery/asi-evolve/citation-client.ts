/**
 * citation-client.ts
 *
 * Adapter for citation.manus.space — the ttruthdesk-platform verification layer.
 *
 * citation.manus.space is the external ground-truth verification system. Every
 * ASI-Evolve candidate claim ("Compound X shows pIC50=Y against HIV-1 protease")
 * must be submitted here for verdict before being counted as verified.
 *
 * API surface (from /.well-known/mcp.json):
 *   POST /api/public/verify-claim          — single claim verdict
 *   POST /api/trpc/documents.create        — submit full document for pipeline
 *   GET  /api/public/claims                — paginated verified claims corpus
 *   GET  /api/public/claims/search         — full-text search over corpus
 *
 * No authentication required for read operations.
 * Rate limits: 30 req/min for verify-claim, generous for GET endpoints.
 *
 * Source: https://github.com/Gudmundur76/ttruthdesk-platform
 * Live:   https://citation.manus.space
 */

const BASE_URL = "https://citation.manus.space";
const TIMEOUT_MS = 20_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CitationVerdict =
  | "Supported"
  | "Contradicted"
  | "Partially Supported"
  | "Ambiguous"
  | "Insufficient Evidence"
  | "Out of Scope"
  | "Needs Expert Review";

export interface VerifyClaimResult {
  verdict: CitationVerdict;
  confidenceScore: number; // 0.0–1.0
  evidenceSource: string;
  pdbId?: string;
  pubchemCid?: number;
  summary: string;
}

export interface CitationClaim {
  claim_id: number;
  claim_text: string;
  verdict: CitationVerdict;
  verdict_rationale?: string;
  confidence_score: number;
  vertical_domain: string;
  pdb_id?: string;
  evidence_url?: string;
  page_url?: string;
  updated_at?: string;
}

export interface ListClaimsResponse {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  claims: CitationClaim[];
}

export interface SearchClaimsResponse {
  query: string;
  total_matches: number;
  returned: number;
  claims: CitationClaim[];
}

export interface SubmitDocumentResult {
  documentId: number;
  status: "pending" | "extracting" | "validating" | "generating_report" | "complete" | "failed";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function citationFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`citation.manus.space ${res.status} ${path}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Verify a single scientific claim against authoritative databases.
 *
 * Use for atomic claims like:
 *   "Compound DRV (darunavir) shows IC50 = 0.003 nM against HIV-1 protease"
 *   "HIV-1 protease cleaves the Gag-Pol polyprotein at the MA/CA junction"
 *
 * Rate-limited to 30 req/min. Returns null on network error (non-throwing).
 */
export async function verifyClaim(
  claim: string,
  vertical = "structural_biology"
): Promise<VerifyClaimResult | null> {
  try {
    return await citationFetch<VerifyClaimResult>("/api/public/verify-claim", {
      method: "POST",
      body: JSON.stringify({ claim, vertical }),
    });
  } catch (err) {
    console.warn("[citation-client] verifyClaim failed:", (err as Error).message);
    return null;
  }
}

/**
 * Submit a full scientific document (e.g. an ASI-Evolve step analysis) for
 * automated claim extraction and verification by the ttruthdesk pipeline.
 *
 * The pipeline runs asynchronously. Poll pollDocumentStatus(docId) to get
 * the final verdict. Returns null on error.
 */
export async function submitDocument(
  title: string,
  rawText: string,
  verticalDomain = "structural_biology"
): Promise<SubmitDocumentResult | null> {
  try {
    // ttruthdesk uses tRPC over HTTP — the documents.create procedure accepts
    // a JSON body matching the tRPC input schema.
    const result = await citationFetch<{ result: { data: SubmitDocumentResult } }>(
      "/api/trpc/documents.create",
      {
        method: "POST",
        body: JSON.stringify({
          title,
          rawText,
          sourceType: "paste",
          verticalDomain,
        }),
      }
    );
    return result?.result?.data ?? null;
  } catch (err) {
    console.warn("[citation-client] submitDocument failed:", (err as Error).message);
    return null;
  }
}

/**
 * Poll the status of a previously submitted document.
 * Returns null if not found or on error.
 */
export async function pollDocumentStatus(
  docId: number
): Promise<SubmitDocumentResult | null> {
  try {
    const result = await citationFetch<{ result: { data: SubmitDocumentResult } }>(
      `/api/trpc/documents.get?input=${encodeURIComponent(JSON.stringify({ id: docId }))}`
    );
    return result?.result?.data ?? null;
  } catch (err) {
    console.warn("[citation-client] pollDocumentStatus failed:", (err as Error).message);
    return null;
  }
}

/**
 * Full-text search over the citation.manus.space verified claims corpus.
 *
 * Use to pull relevant prior art into the ASI-Evolve cognition store.
 * Returns up to `limit` claims matching the query.
 */
export async function searchClaims(
  q: string,
  options: {
    limit?: number;
    verdict?: CitationVerdict;
    vertical?: string;
  } = {}
): Promise<CitationClaim[]> {
  try {
    const params = new URLSearchParams({ q });
    if (options.limit) params.set("limit", String(options.limit));
    if (options.verdict) params.set("verdict", options.verdict);
    if (options.vertical) params.set("vertical", options.vertical);

    const result = await citationFetch<SearchClaimsResponse>(
      `/api/public/claims/search?${params}`
    );
    return result.claims ?? [];
  } catch (err) {
    console.warn("[citation-client] searchClaims failed:", (err as Error).message);
    return [];
  }
}

/**
 * Paginated access to all verified claims in a given vertical.
 *
 * Use with updatedSince for incremental cognition store refreshes.
 * Returns the full ListClaimsResponse including pagination metadata.
 */
export async function listClaimsByVertical(
  vertical = "structural_biology",
  options: {
    page?: number;
    pageSize?: number;
    updatedSince?: string; // ISO 8601
    verdict?: CitationVerdict;
  } = {}
): Promise<ListClaimsResponse> {
  const empty: ListClaimsResponse = { page: 1, page_size: 100, total: 0, total_pages: 0, claims: [] };
  try {
    const params = new URLSearchParams({ vertical });
    if (options.page) params.set("page", String(options.page));
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.updatedSince) params.set("updated_since", options.updatedSince);
    if (options.verdict) params.set("verdict", options.verdict);

    return await citationFetch<ListClaimsResponse>(`/api/public/claims?${params}`);
  } catch (err) {
    console.warn("[citation-client] listClaimsByVertical failed:", (err as Error).message);
    return empty;
  }
}

/**
 * Convenience: fetch the most recent N supported claims for HIV protease.
 * Used by the cognition seeder to bootstrap the knowledge base.
 */
export async function fetchHivProteaseVerifiedClaims(limit = 200): Promise<CitationClaim[]> {
  // First try targeted search
  const searchResults = await searchClaims("HIV protease inhibitor", {
    limit,
    vertical: "structural_biology",
    verdict: "Supported",
  });

  if (searchResults.length > 0) return searchResults;

  // Fallback: pull the full structural_biology corpus and filter client-side
  const page = await listClaimsByVertical("structural_biology", {
    pageSize: 200,
    verdict: "Supported",
  });

  return page.claims.filter(c =>
    /hiv|protease|inhibitor|antiretroviral/i.test(c.claim_text)
  );
}

/**
 * Score modifier based on citation verdict.
 *
 * Supported      → +0.5 (external ground truth confirms the claim)
 * Partially Supported → +0.2
 * Ambiguous      → 0.0 (neutral)
 * Insufficient Evidence → 0.0
 * Contradicted   → -0.3 (external ground truth refutes the claim)
 * Needs Expert Review → 0.0
 * Out of Scope   → 0.0
 */
export function verdictScoreModifier(verdict: CitationVerdict): number {
  switch (verdict) {
    case "Supported":           return +0.5;
    case "Partially Supported": return +0.2;
    case "Contradicted":        return -0.3;
    default:                    return 0.0;
  }
}

/**
 * Build a verifiable claim string from a candidate molecule result.
 * This is the text submitted to citation.manus.space for verdict.
 */
export function buildCandidateClaim(candidate: {
  name: string;
  smiles?: string;
  pic50: number;
  track: string;
  verificationSource?: string;
}): string {
  const source = candidate.verificationSource ?? "HIV-1 protease (UniProt P04585)";
  return (
    `${candidate.name} (SMILES: ${candidate.smiles ?? "N/A"}, Track ${candidate.track}) ` +
    `shows predicted pIC50 = ${candidate.pic50.toFixed(2)} against ${source}. ` +
    `This compound is a small-molecule HIV protease inhibitor candidate derived from ` +
    `ChEMBL/PDB co-crystal scaffold analysis.`
  );
}
