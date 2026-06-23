/**
 * candidate-claim.ts
 *
 * First-class verification layer for HIV protease inhibitor candidates.
 *
 * This module defines:
 *   - CandidateClaim  — the structured claim submitted to citation.manus.space
 *   - VerifiedCandidate — a Candidate enriched with citation verdict fields
 *   - CitationClient   — the minimal interface required by verifyCandidates()
 *   - verifyCandidates() — batch verification with concurrency control
 *
 * Design principles:
 *   - verifyCandidates() accepts any Candidate-like input and returns a
 *     parallel array of VerifiedCandidate, preserving original field order.
 *   - The CitationClient interface is kept minimal so the real client
 *     (citation-client.ts) and test doubles both satisfy it.
 *   - All network errors are caught per-candidate; a failed verification
 *     produces a VerifiedCandidate with verdict "Ambiguous" and confidence 0.
 *   - Concurrency is capped at MAX_CONCURRENT_VERIFICATIONS to respect the
 *     30 req/min rate limit on citation.manus.space.
 *
 * Source of truth: https://github.com/Gudmundur76/ttruthdesk-platform
 * Live endpoint:   https://citation.manus.space
 */

import type { CitationVerdict, VerifyClaimResult } from "./asi-evolve/citation-client";
import type { Candidate } from "../../drizzle/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum simultaneous requests to citation.manus.space (rate limit: 30/min). */
const MAX_CONCURRENT_VERIFICATIONS = 5;

/** Fallback verdict when the citation service is unreachable. */
const FALLBACK_VERDICT: CitationVerdict = "Ambiguous";

// ─────────────────────────────────────────────────────────────────────────────
// CandidateClaim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The structured claim submitted to citation.manus.space for a single
 * HIV protease inhibitor candidate.
 *
 * The `claim` field is the natural-language assertion that the citation
 * service evaluates against its authoritative corpus. All other fields
 * provide provenance metadata for downstream logging and cognition seeding.
 */
export interface CandidateClaim {
  /** Database primary key of the source Candidate row. */
  candidateId: string;

  /**
   * Natural-language assertion submitted to citation.manus.space.
   * Example: "Compound CHEMBL123 shows pIC50=8.5 against HIV-1 protease"
   */
  claim: string;

  /** Human-readable compound name derived from SMILES or ChEMBL ID. */
  compoundName: string;

  /** SMILES string of the candidate molecule. */
  smiles: string;

  /** Predicted pIC50 from the ML ensemble + VQE scoring phase. */
  pic50: number;

  /** Discovery adapter that produced this candidate (e.g. "chembl", "pdb", "python"). */
  source: string;

  /** The discovery query that surfaced this candidate. */
  discoveryQuery: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VerifiedCandidate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Candidate enriched with citation verification fields.
 *
 * Extends the DB Candidate type with four citation-specific fields:
 *   - citationVerdict    — the verdict from citation.manus.space
 *   - citationConfidence — 0.0–1.0 confidence score
 *   - citationDocId      — opaque document/claim ID from the citation service
 *   - citationEvidence   — array of evidence strings (PubMed IDs, PDB IDs, etc.)
 *
 * The original CandidateClaim is also attached for full provenance.
 */
export interface VerifiedCandidate {
  /** Original DB candidate (all fields preserved). */
  candidate: Candidate;

  /** The claim that was submitted for verification. */
  claim: CandidateClaim;

  /**
   * Verdict from citation.manus.space.
   * "Ambiguous" is used as the fallback when verification fails.
   */
  citationVerdict: "Supported" | "Contradicted" | "Ambiguous";

  /** Confidence score returned by the citation service (0.0–1.0). */
  citationConfidence: number;

  /**
   * Opaque identifier for the citation record.
   * Populated from `evidenceSource` or `pdbId`/`pubchemCid` in the API response.
   * Empty string if the service did not return a document reference.
   */
  citationDocId: string;

  /**
   * Array of evidence strings supporting the verdict.
   * May include PubMed IDs, PDB accessions, ChEMBL IDs, or free-text summaries.
   * Empty array if no evidence was returned.
   */
  citationEvidence: string[];

  /** Score modifier applied to the candidate's pIC50 based on the verdict. */
  scoreModifier: number;

  /** ISO 8601 timestamp of when the verification was performed. */
  verifiedAt: string;

  /** Whether the citation gate was passed (Supported or Partially Supported). */
  citationGatePassed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CitationClient interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal interface required by verifyCandidates().
 *
 * The real implementation is the default export of citation-client.ts.
 * Test doubles only need to implement this subset.
 */
export interface CitationClient {
  /**
   * Submit a single claim for verification.
   * Returns null on network error (non-throwing).
   */
  verifyClaim(
    claim: string,
    vertical?: string
  ): Promise<VerifyClaimResult | null>;

  /**
   * Build a natural-language claim string from candidate metadata.
   * Pure function — no network call.
   */
  buildCandidateClaim(candidate: {
    name: string;
    smiles?: string;
    pic50: number;
    track: string;
    verificationSource?: string;
  }): string;

  /**
   * Map a citation verdict to a pIC50 score modifier.
   * Pure function — no network call.
   */
  verdictScoreModifier(verdict: CitationVerdict): number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a human-readable compound name from a Candidate row.
 * Falls back to a truncated SMILES string if no better identifier exists.
 */
function deriveCompoundName(candidate: Candidate): string {
  // Prefer SMILES-derived short name; real projects would use InChIKey or ChEMBL ID
  const smiles = candidate.smiles ?? "";
  if (smiles.length <= 20) return smiles;
  return `${smiles.slice(0, 16)}…`;
}

/**
 * Derive the discovery source from a Candidate row.
 * Uses the track letter as a proxy for the originating adapter.
 */
function deriveSource(candidate: Candidate): string {
  const trackSources: Record<string, string> = {
    A: "chembl",
    B: "pdb",
    C: "bindingdb",
    D: "diverse_scaffolds",
  };
  return trackSources[candidate.track] ?? "unknown";
}

/**
 * Normalise a raw CitationVerdict to the three-value union used by
 * VerifiedCandidate. "Partially Supported" maps to "Supported" because it
 * still passes the citation gate.
 */
function normaliseVerdict(
  raw: CitationVerdict | undefined | null
): "Supported" | "Contradicted" | "Ambiguous" {
  switch (raw) {
    case "Supported":
    case "Partially Supported":
      return "Supported";
    case "Contradicted":
      return "Contradicted";
    default:
      return "Ambiguous";
  }
}

/**
 * Extract evidence strings from a VerifyClaimResult.
 * Builds a de-duplicated array of PubMed IDs, PDB IDs, ChEMBL IDs, and
 * the evidence source description.
 */
function extractEvidence(result: VerifyClaimResult): string[] {
  const evidence: string[] = [];

  if (result.evidenceSource && result.evidenceSource.trim()) {
    evidence.push(result.evidenceSource.trim());
  }
  if (result.pdbId) {
    evidence.push(`PDB:${result.pdbId}`);
  }
  if (result.pubchemCid != null) {
    evidence.push(`PubChem:${result.pubchemCid}`);
  }
  if (result.summary && result.summary.trim()) {
    evidence.push(result.summary.trim());
  }

  // De-duplicate while preserving insertion order
  return Array.from(new Set(evidence));
}

/**
 * Derive an opaque citation document ID from a VerifyClaimResult.
 * Prefers PDB ID > PubChem CID > evidence source slug.
 */
function deriveCitationDocId(result: VerifyClaimResult): string {
  if (result.pdbId) return `pdb:${result.pdbId}`;
  if (result.pubchemCid != null) return `pubchem:${result.pubchemCid}`;
  if (result.evidenceSource) {
    // Convert "PubMed" → "pubmed", "ChEMBL" → "chembl", etc.
    return result.evidenceSource.toLowerCase().replace(/\s+/g, "_");
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// buildCandidateClaims
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a CandidateClaim for each candidate in the input array.
 * Pure function — no network calls.
 *
 * @param candidates  Array of Candidate rows from the DB
 * @param client      CitationClient used to build the claim text
 * @param queryHint   Optional discovery query to attach as provenance
 */
export function buildCandidateClaims(
  candidates: Candidate[],
  client: CitationClient,
  queryHint = "HIV protease inhibitor small molecule binding affinity pIC50"
): CandidateClaim[] {
  return candidates.map((candidate) => {
    const compoundName = deriveCompoundName(candidate);
    const source = deriveSource(candidate);
    const pic50 = candidate.pic50Predicted ?? 0;

    const claim = client.buildCandidateClaim({
      name: compoundName,
      smiles: candidate.smiles ?? undefined,
      pic50,
      track: candidate.track,
      verificationSource: "HIV-1 protease (UniProt P04585)",
    });

    return {
      candidateId: String(candidate.id),
      claim,
      compoundName,
      smiles: candidate.smiles ?? "",
      pic50,
      source,
      discoveryQuery: queryHint,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyCandidates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify an array of Candidates against citation.manus.space and return
 * enriched VerifiedCandidate objects.
 *
 * Concurrency is capped at MAX_CONCURRENT_VERIFICATIONS (5) to respect the
 * 30 req/min rate limit. Failed verifications produce a VerifiedCandidate
 * with verdict "Ambiguous" and confidence 0 rather than throwing.
 *
 * @param candidates  Candidates to verify (typically the top-N by pIC50)
 * @param client      CitationClient implementation (real or test double)
 * @param options     Optional overrides
 * @returns           Parallel array of VerifiedCandidate in input order
 */
export async function verifyCandidates(
  candidates: Candidate[],
  client: CitationClient,
  options: {
    /** Vertical domain passed to citation.manus.space (default: structural_biology). */
    vertical?: string;
    /** Override the discovery query attached to each claim. */
    queryHint?: string;
    /** Override the concurrency limit. */
    concurrency?: number;
  } = {}
): Promise<VerifiedCandidate[]> {
  if (candidates.length === 0) return [];

  const vertical = options.vertical ?? "structural_biology";
  const queryHint = options.queryHint;
  const concurrency = options.concurrency ?? MAX_CONCURRENT_VERIFICATIONS;

  // Build all claims upfront (pure, no I/O)
  const claims = buildCandidateClaims(candidates, client, queryHint);

  const results: VerifiedCandidate[] = new Array(candidates.length);

  // Process in batches to respect the concurrency cap
  for (let batchStart = 0; batchStart < candidates.length; batchStart += concurrency) {
    const batchEnd = Math.min(batchStart + concurrency, candidates.length);
    const batchIndices = Array.from(
      { length: batchEnd - batchStart },
      (_, i) => batchStart + i
    );

    await Promise.all(
      batchIndices.map(async (idx) => {
        const candidate = candidates[idx];
        const claim = claims[idx];
        const verifiedAt = new Date().toISOString();

        let citationVerdict: "Supported" | "Contradicted" | "Ambiguous" = "Ambiguous";
        let citationConfidence = 0;
        let citationDocId = "";
        let citationEvidence: string[] = [];
        let scoreModifier = 0;

        try {
          const result = await client.verifyClaim(claim.claim, vertical);

          if (result) {
            const rawVerdict: CitationVerdict = result.verdict;
            citationVerdict = normaliseVerdict(rawVerdict);
            citationConfidence = result.confidenceScore;
            citationDocId = deriveCitationDocId(result);
            citationEvidence = extractEvidence(result);
            scoreModifier = client.verdictScoreModifier(rawVerdict);
          } else {
            // verifyClaim returned null (network error, already logged by client)
            console.warn(
              `[candidate-claim] verifyClaim returned null for candidate ${claim.candidateId} ` +
              `(SMILES: ${claim.smiles.slice(0, 30)})`
            );
          }
        } catch (err) {
          // Unexpected error — log and fall through to defaults
          console.error(
            `[candidate-claim] Unexpected error verifying candidate ${claim.candidateId}:`,
            err instanceof Error ? err.message : String(err)
          );
        }

        const citationGatePassed =
          citationVerdict === "Supported" && citationConfidence >= 0.5;

        results[idx] = {
          candidate,
          claim,
          citationVerdict,
          citationConfidence,
          citationDocId,
          citationEvidence,
          scoreModifier,
          verifiedAt,
          citationGatePassed,
        };
      })
    );
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: build a CitationClient from the real citation-client module
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a CitationClient backed by the real citation.manus.space adapter.
 * Import lazily to avoid pulling in network dependencies during tests.
 */
export async function createRealCitationClient(): Promise<CitationClient> {
  const mod = await import("./asi-evolve/citation-client");
  return {
    verifyClaim: mod.verifyClaim,
    buildCandidateClaim: mod.buildCandidateClaim,
    verdictScoreModifier: mod.verdictScoreModifier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// feedbackVerdictsToCognition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Priority weights assigned to each citation verdict when seeding the
 * evolve_cognition store.  Higher priority items are retrieved first during
 * UCB1 sampling and Researcher query generation.
 *
 * - Supported      → highest priority: confirmed binding data is the most
 *                    valuable signal for the next discovery iteration.
 * - Contradicted   → high priority: contradictions must be surfaced so the
 *                    Researcher can avoid repeating disproved hypotheses.
 * - Ambiguous      → lower priority: uncertain evidence is still useful as
 *                    weak signal but should not dominate the context window.
 */
const VERDICT_PRIORITY: Record<CitationVerdict, number> = {
  Supported: 10,
  Contradicted: 7,
  "Partially Supported": 8,
  Ambiguous: 3,
  "Insufficient Evidence": 2,
  "Out of Scope": 1,
  "Needs Expert Review": 4,
};

/**
 * Source-type mapping: each verdict class maps to the most semantically
 * appropriate CognitionItem.source_type for downstream retrieval filtering.
 */
const VERDICT_SOURCE_TYPE: Record<
  CitationVerdict,
  "chembl" | "pubchem" | "manual"
> = {
  Supported: "chembl",              // confirmed binding data → ChEMBL-class
  "Partially Supported": "chembl",  // partial evidence → still ChEMBL-class
  Contradicted: "pubchem",          // disproved claim → PubChem-class
  Ambiguous: "manual",              // uncertain → manual curation class
  "Insufficient Evidence": "manual",
  "Out of Scope": "manual",
  "Needs Expert Review": "manual",
};

/**
 * Build the natural-language content string stored in evolve_cognition for a
 * single VerifiedCandidate.  The framing differs per verdict so the Researcher
 * LLM receives appropriately weighted context.
 */
function buildCognitionContent(vc: VerifiedCandidate): string {
  const pct = (vc.citationConfidence * 100).toFixed(0);
  const mod = vc.scoreModifier >= 0 ? `+${vc.scoreModifier}` : `${vc.scoreModifier}`;
  const doc = vc.citationDocId ? ` [doc: ${vc.citationDocId}]` : "";
  const evid =
    vc.citationEvidence.length > 0
      ? ` Evidence: ${vc.citationEvidence.slice(0, 3).join(" | ")}.`
      : "";

  switch (vc.citationVerdict) {
    case "Supported":
      return (
        `[SUPPORTED | confidence ${pct}% | score ${mod}]${doc} ` +
        `${vc.claim.claim}` +
        `${evid} ` +
        `SMILES: ${vc.claim.smiles}. ` +
        `Prioritise modifications to this scaffold in the next iteration.`
      ).slice(0, 1200);

    case "Contradicted":
      return (
        `[CONTRADICTED | confidence ${pct}% | score ${mod}]${doc} ` +
        `${vc.claim.claim}` +
        `${evid} ` +
        `SMILES: ${vc.claim.smiles}. ` +
        `Avoid this scaffold class; literature evidence refutes the claimed activity.`
      ).slice(0, 1200);

    case "Ambiguous":
    default:
      return (
        `[AMBIGUOUS | confidence ${pct}% | score ${mod}]${doc} ` +
        `${vc.claim.claim}` +
        `${evid} ` +
        `SMILES: ${vc.claim.smiles}. ` +
        `Insufficient evidence; treat as weak signal only.`
      ).slice(0, 1200);
  }
}

/**
 * Derive a stable, human-readable source identifier for a VerifiedCandidate.
 * Format: "citation_verdict:<VERDICT>:<SMILES_PREFIX>:<DOC_ID_OR_NONE>"
 */
function buildCognitionSource(vc: VerifiedCandidate): string {
  const smilesPrefix = vc.claim.smiles.slice(0, 24).replace(/\s+/g, "_");
  const docPart = vc.citationDocId ? vc.citationDocId.slice(0, 20) : "none";
  return `citation_verdict:${vc.citationVerdict}:${smilesPrefix}:${docPart}`;
}

/**
 * Feed citation verdicts from a verification pass back into the evolve_cognition
 * store so that the ASI-Evolve Researcher can use them as grounded context in
 * the next discovery iteration.
 *
 * Behaviour per verdict:
 *   - Supported      → high-priority item framed as confirmed binding evidence
 *   - Contradicted   → medium-priority item flagging the disproved hypothesis
 *   - Ambiguous      → low-priority item noting the uncertainty
 *
 * Deduplication strategy: because evolve_cognition has no unique constraint,
 * a source-based lookup is performed before each insert.  If a row with the
 * same `source` string already exists for the current run, the insert is
 * skipped (soft-upsert).  This prevents the same verdict from being added
 * multiple times across consecutive cycles while keeping the schema unchanged.
 *
 * @param verified  Array of VerifiedCandidate objects from verifyCandidates()
 * @param runId     The ASI-Evolve run ID to associate items with.
 *                  If omitted, getOrCreateRun() is called once to resolve it.
 * @returns         The number of new items actually inserted (skips = not counted)
 */
export async function feedbackVerdictsToCognition(
  verified: VerifiedCandidate[],
  runId?: number
): Promise<number> {
  if (verified.length === 0) return 0;

  // Lazy import to avoid pulling in DB/network deps during tests
  const { addCognitionItem } = await import("./asi-evolve/cognition");
  const { getOrCreateRun } = await import("./asi-evolve/database");
  const mysql = await import("mysql2/promise");

  // Resolve run ID once
  const resolvedRunId = runId ?? (await getOrCreateRun());

  // Build a pool for the dedup lookup (reuse env DATABASE_URL)
  const pool = mysql.createPool(process.env.DATABASE_URL!);

  let inserted = 0;

  try {
    for (const vc of verified) {
      const source = buildCognitionSource(vc);

      // ── Soft-upsert: skip if this source already exists for this run ──────
      const [existing] = await pool.execute(
        `SELECT id FROM evolve_cognition WHERE run_id = ? AND source = ? LIMIT 1`,
        [resolvedRunId, source]
      ) as [any[], any];

      if (existing.length > 0) {
        // Already seeded in a prior cycle — skip to avoid duplication
        continue;
      }

      const content = buildCognitionContent(vc);
      const sourceType = VERDICT_SOURCE_TYPE[vc.citationVerdict];
      const priority = VERDICT_PRIORITY[vc.citationVerdict];

      await addCognitionItem({
        run_id: resolvedRunId,
        content,
        source,
        source_type: sourceType,
        embedding: [],
        created_at: Date.now(),
        metadata: {
          // Core citation fields
          verdict: vc.citationVerdict,
          confidence: vc.citationConfidence,
          scoreModifier: vc.scoreModifier,
          citationDocId: vc.citationDocId,
          citationEvidence: vc.citationEvidence,
          citationGatePassed: vc.citationGatePassed,
          verifiedAt: vc.verifiedAt,
          // Candidate provenance
          candidateId: vc.claim.candidateId,
          smiles: vc.claim.smiles,
          compoundName: vc.claim.compoundName,
          pic50: vc.claim.pic50,
          claimSource: vc.claim.source,
          discoveryQuery: vc.claim.discoveryQuery,
          // Routing metadata
          priority,
          phase: "feedback_verdicts_to_cognition",
        },
      });

      inserted++;
    }
  } finally {
    await pool.end();
  }

  return inserted;
}
