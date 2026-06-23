/**
 * candidate-claim.test.ts
 *
 * Unit tests for the CandidateClaim / verifyCandidates() verification layer.
 *
 * All tests use an in-process CitationClient test double — no real network calls.
 *
 * Test plan:
 *   1. buildCandidateClaims — builds correct claim text and metadata
 *   2. verifyCandidates / Supported — citationGatePassed=true, scoreModifier>0
 *   3. verifyCandidates / Contradicted — citationGatePassed=false, scoreModifier<0
 *   4. verifyCandidates / Ambiguous — citationGatePassed=false, scoreModifier=0
 *   5. verifyCandidates / Partially Supported — normalised to "Supported"
 *   6. verifyCandidates / null response — graceful fallback to "Ambiguous"
 *   7. verifyCandidates / empty input — returns empty array
 *   8. verifyCandidates / concurrency — all candidates processed in batched order
 *   9. verifyCandidates / evidence extraction — citationDocId and citationEvidence populated
 *  10. verifyCandidates / preserves input order — results match input index
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildCandidateClaims,
  verifyCandidates,
  type CitationClient,
  type CandidateClaim,
  type VerifiedCandidate,
} from "./candidate-claim";
import type { Candidate } from "../../drizzle/schema";
import type { VerifyClaimResult } from "./asi-evolve/citation-client";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 1,
    cycleId: 10,
    smiles: "CC(=O)O",
    parentSmiles: "CC(=O)O",
    track: "A",
    modificationType: "add_group",
    pic50Predicted: 8.5,
    confidenceScore: 0.9,
    pic50Vqe: 8.6,
    quantumHardware: "full_amplitude",
    quantumScore: 0.75,
    provenanceStatus: "QUANTUM_SIM",
    citationVerdict: null,
    citationConfidence: null,
    citationGatePassed: false,
    pubmedIds: [],
    citationIds: [],
    mw: 60.05,
    logp: -0.17,
    hbd: 1,
    hba: 2,
    tpsa: 37.3,
    lipinskiViolations: 0,
    isDruglike: true,
    isNovel: true,
    tanimotoToApproved: 0.2,
    isBestSoFar: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeVerifyResult(
  overrides: Partial<VerifyClaimResult> = {}
): VerifyClaimResult {
  return {
    verdict: "Supported",
    confidenceScore: 0.85,
    evidenceSource: "PubMed",
    summary: "Supported by 3 papers",
    pdbId: "1HVR",
    pubchemCid: 12345,
    ...overrides,
  };
}

/** Build a CitationClient test double with configurable verifyClaim behaviour. */
function makeMockClient(
  verifyImpl: (claim: string) => Promise<VerifyClaimResult | null>
): CitationClient {
  return {
    verifyClaim: vi.fn(verifyImpl),
    buildCandidateClaim: vi.fn((c) =>
      `${c.name} (SMILES: ${c.smiles ?? "N/A"}, Track ${c.track}) shows predicted pIC50 = ${c.pic50.toFixed(2)} against HIV-1 protease.`
    ),
    verdictScoreModifier: vi.fn((verdict) => {
      switch (verdict) {
        case "Supported":           return 0.5;
        case "Partially Supported": return 0.2;
        case "Contradicted":        return -0.3;
        default:                    return 0.0;
      }
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCandidateClaims", () => {
  it("builds a CandidateClaim for each candidate with correct fields", () => {
    const candidates = [
      makeCandidate({ id: 1, smiles: "CC(=O)O", track: "A", pic50Predicted: 8.5 }),
      makeCandidate({ id: 2, smiles: "c1ccccc1", track: "B", pic50Predicted: 7.2 }),
    ];
    const client = makeMockClient(async () => null);

    const claims = buildCandidateClaims(candidates, client, "HIV protease query");

    expect(claims).toHaveLength(2);

    const [c1, c2] = claims;

    // candidateId is the string form of the DB id
    expect(c1.candidateId).toBe("1");
    expect(c2.candidateId).toBe("2");

    // SMILES are preserved
    expect(c1.smiles).toBe("CC(=O)O");
    expect(c2.smiles).toBe("c1ccccc1");

    // pIC50 comes from pic50Predicted
    expect(c1.pic50).toBeCloseTo(8.5, 2);
    expect(c2.pic50).toBeCloseTo(7.2, 2);

    // Source is derived from track
    expect(c1.source).toBe("chembl");  // Track A → chembl
    expect(c2.source).toBe("pdb");     // Track B → pdb

    // discoveryQuery is passed through
    expect(c1.discoveryQuery).toBe("HIV protease query");

    // claim text is non-empty and contains pIC50
    expect(c1.claim).toContain("8.50");
    expect(c2.claim).toContain("7.20");

    // buildCandidateClaim was called once per candidate
    expect(vi.mocked(client.buildCandidateClaim)).toHaveBeenCalledTimes(2);
  });

  it("handles long SMILES by truncating the compound name", () => {
    const longSmiles = "C".repeat(40);
    const candidate = makeCandidate({ smiles: longSmiles, id: 99 });
    const client = makeMockClient(async () => null);

    const [claim] = buildCandidateClaims([candidate], client);

    // compoundName should be truncated (≤ 20 chars + ellipsis)
    expect(claim.compoundName.length).toBeLessThanOrEqual(21);
    expect(claim.compoundName).toContain("…");
  });
});

describe("verifyCandidates / Supported verdict", () => {
  it("returns citationGatePassed=true and positive scoreModifier", async () => {
    const candidates = [makeCandidate({ id: 1, pic50Predicted: 8.5 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({ verdict: "Supported", confidenceScore: 0.9 })
    );

    const results = await verifyCandidates(candidates, client);

    expect(results).toHaveLength(1);
    const r = results[0];

    expect(r.citationVerdict).toBe("Supported");
    expect(r.citationConfidence).toBeCloseTo(0.9, 2);
    expect(r.citationGatePassed).toBe(true);
    expect(r.scoreModifier).toBeCloseTo(0.5, 2);
    expect(r.candidate.id).toBe(1);
    expect(r.claim.candidateId).toBe("1");
  });

  it("populates citationDocId from PDB ID when present", async () => {
    const candidates = [makeCandidate({ id: 2 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({ verdict: "Supported", pdbId: "1HVR", pubchemCid: undefined })
    );

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationDocId).toBe("pdb:1HVR");
  });

  it("populates citationEvidence with evidenceSource, PDB ID, and summary", async () => {
    const candidates = [makeCandidate({ id: 3 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({
        verdict: "Supported",
        evidenceSource: "PubMed",
        pdbId: "1HVR",
        pubchemCid: 12345,
        summary: "Supported by 3 papers",
      })
    );

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationEvidence).toContain("PubMed");
    expect(result.citationEvidence).toContain("PDB:1HVR");
    expect(result.citationEvidence).toContain("PubChem:12345");
    expect(result.citationEvidence).toContain("Supported by 3 papers");
    // No duplicates
    expect(new Set(result.citationEvidence).size).toBe(result.citationEvidence.length);
  });
});

describe("verifyCandidates / Contradicted verdict", () => {
  it("returns citationGatePassed=false and negative scoreModifier", async () => {
    const candidates = [makeCandidate({ id: 4 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({ verdict: "Contradicted", confidenceScore: 0.8 })
    );

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationVerdict).toBe("Contradicted");
    expect(result.citationGatePassed).toBe(false);
    expect(result.scoreModifier).toBeCloseTo(-0.3, 2);
  });
});

describe("verifyCandidates / Ambiguous verdict", () => {
  it("returns citationGatePassed=false and zero scoreModifier", async () => {
    const candidates = [makeCandidate({ id: 5 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({ verdict: "Ambiguous", confidenceScore: 0.4 })
    );

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationVerdict).toBe("Ambiguous");
    expect(result.citationGatePassed).toBe(false);
    expect(result.scoreModifier).toBeCloseTo(0.0, 2);
  });

  it("maps Insufficient Evidence to Ambiguous", async () => {
    const candidates = [makeCandidate({ id: 6 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({ verdict: "Insufficient Evidence", confidenceScore: 0.3 })
    );

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationVerdict).toBe("Ambiguous");
  });
});

describe("verifyCandidates / Partially Supported verdict", () => {
  it("normalises Partially Supported to Supported", async () => {
    const candidates = [makeCandidate({ id: 7 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({ verdict: "Partially Supported", confidenceScore: 0.65 })
    );

    const [result] = await verifyCandidates(candidates, client);

    // Normalised to Supported
    expect(result.citationVerdict).toBe("Supported");
    // But confidence is below 0.5 threshold → gate still passes because verdict is Supported
    // (confidence 0.65 ≥ 0.5 → gate passes)
    expect(result.citationGatePassed).toBe(true);
    // scoreModifier comes from the raw "Partially Supported" verdict
    expect(result.scoreModifier).toBeCloseTo(0.2, 2);
  });
});

describe("verifyCandidates / null response (network error)", () => {
  it("returns Ambiguous with zero confidence and empty evidence on null", async () => {
    const candidates = [makeCandidate({ id: 8 })];
    const client = makeMockClient(async () => null);

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationVerdict).toBe("Ambiguous");
    expect(result.citationConfidence).toBe(0);
    expect(result.citationDocId).toBe("");
    expect(result.citationEvidence).toEqual([]);
    expect(result.scoreModifier).toBe(0);
    expect(result.citationGatePassed).toBe(false);
  });

  it("does not throw when verifyClaim throws unexpectedly", async () => {
    const candidates = [makeCandidate({ id: 9 })];
    const client = makeMockClient(async () => {
      throw new Error("Unexpected network failure");
    });

    // Should not throw
    const results = await verifyCandidates(candidates, client);

    expect(results).toHaveLength(1);
    expect(results[0].citationVerdict).toBe("Ambiguous");
    expect(results[0].citationGatePassed).toBe(false);
  });
});

describe("verifyCandidates / empty input", () => {
  it("returns an empty array immediately without calling verifyClaim", async () => {
    const client = makeMockClient(async () => makeVerifyResult());

    const results = await verifyCandidates([], client);

    expect(results).toEqual([]);
    expect(vi.mocked(client.verifyClaim)).not.toHaveBeenCalled();
  });
});

describe("verifyCandidates / concurrency and input order", () => {
  it("processes all candidates and preserves input order", async () => {
    // 8 candidates — more than the default concurrency cap of 5
    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeCandidate({ id: i + 1, pic50Predicted: 8 - i * 0.1 })
    );

    // Each candidate gets a distinct confidence score based on its id
    const client = makeMockClient(async (claim) => {
      // Extract id from claim text (the compoundName contains the truncated SMILES)
      return makeVerifyResult({ verdict: "Supported", confidenceScore: 0.5 });
    });

    const results = await verifyCandidates(candidates, client, { concurrency: 3 });

    expect(results).toHaveLength(8);

    // Results must be in the same order as input
    for (let i = 0; i < 8; i++) {
      expect(results[i].candidate.id).toBe(i + 1);
      expect(results[i].claim.candidateId).toBe(String(i + 1));
    }

    // All 8 candidates were verified
    expect(vi.mocked(client.verifyClaim)).toHaveBeenCalledTimes(8);
  });

  it("passes the vertical option to verifyClaim", async () => {
    const candidates = [makeCandidate({ id: 10 })];
    const client = makeMockClient(async () => makeVerifyResult());

    await verifyCandidates(candidates, client, { vertical: "pharmacology" });

    expect(vi.mocked(client.verifyClaim)).toHaveBeenCalledWith(
      expect.any(String),
      "pharmacology"
    );
  });
});

describe("verifyCandidates / citationDocId derivation", () => {
  it("falls back to PubChem CID when no PDB ID is present", async () => {
    const candidates = [makeCandidate({ id: 11 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({ pdbId: undefined, pubchemCid: 99999 })
    );

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationDocId).toBe("pubchem:99999");
  });

  it("falls back to evidence source slug when no PDB or PubChem ID", async () => {
    const candidates = [makeCandidate({ id: 12 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({ pdbId: undefined, pubchemCid: undefined, evidenceSource: "ChEMBL" })
    );

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationDocId).toBe("chembl");
  });

  it("returns empty string when no identifiers are available", async () => {
    const candidates = [makeCandidate({ id: 13 })];
    const client = makeMockClient(async () =>
      makeVerifyResult({
        pdbId: undefined,
        pubchemCid: undefined,
        evidenceSource: "",
        summary: "",
      })
    );

    const [result] = await verifyCandidates(candidates, client);

    expect(result.citationDocId).toBe("");
  });
});

describe("verifyCandidates / verifiedAt timestamp", () => {
  it("sets verifiedAt to a valid ISO 8601 timestamp", async () => {
    const candidates = [makeCandidate({ id: 14 })];
    const client = makeMockClient(async () => makeVerifyResult());

    const before = new Date().toISOString();
    const [result] = await verifyCandidates(candidates, client);
    const after = new Date().toISOString();

    expect(result.verifiedAt >= before).toBe(true);
    expect(result.verifiedAt <= after).toBe(true);
    // ISO 8601 format
    expect(result.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
