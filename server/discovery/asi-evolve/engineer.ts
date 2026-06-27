/**
 * ASI-Evolve Engineer Agent — TypeScript port of pipeline/engineer/engineer.py
 * Executes the Researcher's strategy: generates candidates, scores them, verifies top hits.
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

import type { EvolveResults, CandidateResult } from "./types";
import type { ResearchStrategy } from "./researcher";
import { computeAdmet } from "../chemistry";
import { quantumScore, predictPic50 } from "../predictor";
import { verifyCandidatePublicDb } from "./verifier";
import { fetchChEMBLRecords, fetchPubChemHIVCompounds, fetchPubChemBioassay } from "./public-db";

// ─── Dynamic Seed SMILES Library ────────────────────────────────────────────
// Bootstrapped from ttruthdesk sources: PubChem + ChEMBL + static fallbacks
// Static fallbacks are used when the live APIs are unreachable.

let _dynamicSeeds: Record<string, string[]> | null = null;
let _seedFetchedAt = 0;
const SEED_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Fetch live seeds from PubChem and ChEMBL; fall back to static library. */
async function getDynamicSeeds(): Promise<Record<string, string[]>> {
  const now = Date.now();
  if (_dynamicSeeds && now - _seedFetchedAt < SEED_CACHE_TTL_MS) {
    return _dynamicSeeds;
  }

  const liveSeeds: Record<string, string[]> = {
    hydroxyethylamine: [],
    bis_thf: [],
    cyclic_urea: [],
    dihydropyrone: [],
  };

  try {
    // PubChem: HIV protease inhibitor compounds
    const [nameCompounds, bioassayCompounds] = await Promise.all([
      fetchPubChemHIVCompounds(20),
      fetchPubChemBioassay(30),
    ]);
    const pubchemSmiles = [...nameCompounds, ...bioassayCompounds]
      .filter(c => c.smiles && c.smiles.length > 10 && c.smiles.length < 200)
      .map(c => c.smiles)
      .slice(0, 20);
    // Distribute PubChem seeds across tracks
    for (let i = 0; i < pubchemSmiles.length; i++) {
      const track = ["hydroxyethylamine", "bis_thf", "cyclic_urea", "dihydropyrone"][i % 4];
      liveSeeds[track].push(pubchemSmiles[i]);
    }
    console.log(`[Engineer] PubChem seeds: ${pubchemSmiles.length}`);
  } catch (e) {
    console.warn("[Engineer] PubChem seed fetch failed:", (e as Error).message);
  }

  try {
    // ChEMBL: high-affinity HIV protease binders (pIC50 >= 8 = IC50 <= 10nM)
    const chemblRecords = await fetchChEMBLRecords(50);
    const highAffinity = chemblRecords
      .filter(r => r.pchembl_value >= 8.0 && r.smiles && r.smiles.length > 10 && r.smiles.length < 200)
      .sort((a, b) => b.pchembl_value - a.pchembl_value)
      .slice(0, 20);
    // Distribute ChEMBL seeds across tracks by pIC50 quartile
    highAffinity.forEach((r, i) => {
      const track = ["hydroxyethylamine", "bis_thf", "cyclic_urea", "dihydropyrone"][i % 4];
      liveSeeds[track].push(r.smiles);
    });
    console.log(`[Engineer] ChEMBL seeds: ${highAffinity.length} (pIC50 >= 8.0)`);
  } catch (e) {
    console.warn("[Engineer] ChEMBL seed fetch failed:", (e as Error).message);
  }

  // Merge with static fallbacks (live seeds take priority, static fills gaps)
  const merged: Record<string, string[]> = {};
  for (const [track, staticSeeds] of Object.entries(STATIC_SEED_SMILES)) {
    const live = liveSeeds[track] || [];
    // Deduplicate: live seeds first, then static seeds not already in live
    const liveSet = new Set(live);
    const combined = [...live, ...staticSeeds.filter(s => !liveSet.has(s))];
    merged[track] = combined.slice(0, 10); // max 10 per track
  }

  _dynamicSeeds = merged;
  _seedFetchedAt = now;
  const total = Object.values(merged).reduce((s, a) => s + a.length, 0);
  console.log(`[Engineer] Seed library refreshed: ${total} total scaffolds`);
  return merged;
}

/** Static fallback seed library — used when live APIs are unreachable */
const STATIC_SEED_SMILES: Record<string, string[]> = {
  // Track A: Hydroxyethylamine scaffolds (saquinavir/lopinavir family)
  hydroxyethylamine: [
    "CC(C)(C)NC(=O)[C@@H]1C[C@@H]2CCCC[C@@H]2CN1C[C@@H](O)[C@H](Cc1ccccc1)NC(=O)[C@H](CC(=O)N)NC(=O)c1ccc2ccccc2n1",
    "CC(C)(C)NC(=O)[C@@H]1C[C@@H]2CCCC[C@@H]2CN1C[C@@H](O)[C@H](Cc1ccccc1)NC(=O)[C@H](CC(N)=O)NC(=O)c1ccc2ccccc2n1",
    "CC(C)c1ccc(CC[C@@H](O)[C@H](Cc2ccccc2)NC(=O)[C@H](CC(N)=O)NC(=O)c2ccc3ccccc3n2)cc1",
    "O=C(N[C@@H](Cc1ccccc1)[C@@H](O)CN1C[C@H]2CCCC[C@@H]2C1)c1ccc2ccccc2n1",
    "CC(C)(C)NC(=O)[C@H]1CN(C[C@@H](O)[C@H](Cc2ccccc2)NC(=O)c2ccc3ccccc3n2)CC1",
  ],
  // Track B: Bis-THF scaffolds (darunavir family)
  bis_thf: [
    "CC(C)(C)NS(=O)(=O)c1ccc(CC[C@@H](O)[C@H](Cc2ccccc2)NC(=O)O[C@@H]2CO[C@@H]3OCC[C@H]23)cc1",
    "CC(C)(C)NS(=O)(=O)c1ccc(C[C@@H](O)[C@H](Cc2ccccc2)NC(=O)O[C@@H]2CO[C@@H]3OCC[C@H]23)cc1",
    "O=C(O[C@@H]1CO[C@@H]2OCC[C@H]12)N[C@@H](Cc1ccccc1)[C@@H](O)CN1C[C@H]2CCCC[C@@H]2C1",
    "CC(C)(C)NS(=O)(=O)c1ccc(C[C@@H](O)[C@H](Cc2ccc(F)cc2)NC(=O)O[C@@H]2CO[C@@H]3OCC[C@H]23)cc1",
    "Cc1ccc(S(=O)(=O)NC(C)(C)C)cc1C[C@@H](O)[C@H](Cc1ccccc1)NC(=O)O[C@@H]1CO[C@@H]2OCC[C@H]12",
  ],
  // Track C: Cyclic urea scaffolds (DMP323/DMP450 family)
  cyclic_urea: [
    "O=C1NC(=O)[C@@H](Cc2ccccc2)[C@H](Cc2ccccc2)N1",
    "O=C1N(Cc2ccccc2)C(=O)[C@@H](Cc2ccccc2)[C@H](Cc2ccccc2)N1Cc1ccccc1",
    "O=C1NC(=O)[C@@H](Cc2ccc(O)cc2)[C@H](Cc2ccc(O)cc2)N1",
    "O=C1N(Cc2ccc(F)cc2)C(=O)[C@@H](Cc2ccccc2)[C@H](Cc2ccccc2)N1Cc1ccc(F)cc1",
    "O=C1NC(=O)[C@@H](Cc2ccc(Cl)cc2)[C@H](Cc2ccc(Cl)cc2)N1",
  ],
  // Track D: Dihydropyrone/non-peptidic scaffolds (tipranavir family)
  dihydropyrone: [
    "CCCS(=O)(=O)Nc1ccc(-c2cc(CC(CC(=O)c3ccc(F)cc3)c3cc(=O)oc(=O)c3)ccc2O)cc1",
    "CCCS(=O)(=O)Nc1ccc(-c2cc(CC(CC(=O)c3ccc(Cl)cc3)c3cc(=O)oc(=O)c3)ccc2O)cc1",
    "CCCS(=O)(=O)Nc1ccc(-c2cc(CC(CC(=O)c3cccc(F)c3)c3cc(=O)oc(=O)c3)ccc2O)cc1",
    "O=c1oc(=O)cc(C[C@@H](CC(=O)c2ccc(F)cc2)c2ccc(-c3ccc(NS(=O)(=O)CCC)cc3)c(O)c2)c1",
    "CCCS(=O)(=O)Nc1ccc(-c2cc(CC(CC(=O)c3ccc(OC)cc3)c3cc(=O)oc(=O)c3)ccc2O)cc1",
  ],
};

// ─── Mutation Operations ──────────────────────────────────────────────────────

const SUBSTITUENTS = {
  // P2 modifications
  p2_groups: ["OC", "OCC", "OCCC", "OC(C)C", "OC1CCCO1", "OC1CCCCO1", "NC(=O)C", "NC(=O)CC"],
  // P1' hydrophobic groups
  p1_prime: ["c1ccccc1", "c1ccc(F)cc1", "c1ccc(Cl)cc1", "c1ccc(OC)cc1", "C1CCCCC1", "C1CCCC1"],
  // Sulfonamide variations
  sulfonamide: ["NS(=O)(=O)C(C)(C)C", "NS(=O)(=O)c1ccccc1", "NS(=O)(=O)CC", "NS(=O)(=O)CCC"],
  // Amine caps
  amine_caps: ["NC(=O)C(C)(C)C", "NC(=O)c1ccccc1", "NC(=O)CC", "NC(=O)CCC", "NC(=O)c1ccc(F)cc1"],
};

/**
 * Apply simple SMILES mutations to generate candidate variants.
 * Uses string-level operations — no RDKit required for generation.
 */
function mutateSMILES(smiles: string, strategy: ResearchStrategy): string[] {
  const variants: string[] = [smiles]; // always include parent

  // Fluorine scan: replace H-adjacent positions
  if (smiles.includes("c1ccccc1")) {
    variants.push(smiles.replace("c1ccccc1", "c1ccc(F)cc1"));
    variants.push(smiles.replace("c1ccccc1", "c1ccc(Cl)cc1"));
    variants.push(smiles.replace("c1ccccc1", "c1ccc(CF)cc1"));
  }

  // Methyl scan on sp3 carbons
  if (smiles.includes("CC(C)")) {
    variants.push(smiles.replace("CC(C)", "CC(C)(C)"));
  }

  // Hydroxyl → methoxy
  if (smiles.includes("[OH]") || smiles.includes("(O)")) {
    variants.push(smiles.replace("(O)", "(OC)"));
  }

  // Strategy-specific modifications
  const strategyName = strategy.name.toLowerCase();
  if (strategyName.includes("bis_thf") || strategyName.includes("darunavir")) {
    // Add bis-THF P2 group
    if (!smiles.includes("OC1CO")) {
      variants.push(smiles + "NC(=O)O[C@@H]1CO[C@@H]2OCC[C@H]12");
    }
  }

  if (strategyName.includes("sulfonamide")) {
    for (const sa of SUBSTITUENTS.sulfonamide.slice(0, 2)) {
      variants.push(smiles.replace("NC(=O)", sa));
    }
  }

  return Array.from(new Set(variants)).slice(0, 5); // deduplicate, max 5 per parent
}

// ─── Candidate Generation ─────────────────────────────────────────────────────

/**
 * Generate candidates from a strategy.
 * Faithful to ASI-Evolve's Engineer contract:
 * - Executes the strategy
 * - Returns structured EvolveResults
 */
export async function executeStrategy(
  strategy: ResearchStrategy,
  stepName: string,
  candidatesPerTrack: number = 50
): Promise<EvolveResults> {
  const allCandidates: CandidateResult[] = [];
  const tracks = ["A", "B", "C", "D"] as const;

  // Fetch live seeds from PubChem + ChEMBL (with static fallback)
  const seedLib = await getDynamicSeeds();
  const trackSeeds = [
    seedLib.hydroxyethylamine,
    seedLib.bis_thf,
    seedLib.cyclic_urea,
    seedLib.dihydropyrone,
  ];

  for (let t = 0; t < 4; t++) {
    const track = tracks[t];
    const seeds = trackSeeds[t];
    const trackCandidates: CandidateResult[] = [];

    // Generate mutations from seeds
    for (const seed of seeds) {
      const variants = mutateSMILES(seed, strategy);
      for (const smiles of variants) {
        if (trackCandidates.length >= candidatesPerTrack) break;

        try {
          // Score with ML ensemble
          const predResult = await predictPic50(smiles);
          if (!predResult) continue;
          const pic50 = predResult.pic50;
          const admet = await computeAdmet(smiles);
          if (!admet) continue;

          trackCandidates.push({
            smiles,
            pic50,
            admet: {
              mw: admet.mw,
              logp: admet.logp,
              hbd: admet.hbd,
              hba: admet.hba,
              tpsa: admet.tpsa,
              rotbonds: admet.lipinskiViolations, // mapped from lipinskiViolations
              passes: admet.isDruglike,
            },
            verified: false,
            verification_sources: [],
            track,
          });
        } catch {
          // Skip invalid SMILES
        }
      }
    }

    allCandidates.push(...trackCandidates);
  }

  if (allCandidates.length === 0) {
    return {
      eval_score: 0,
      success: false,
      top10_mean_pic50: 0,
      top10_verified_count: 0,
      best_pic50: 0,
      best_smiles: "",
      admet_pass_rate: 0,
      track: "A",
      error: "No valid candidates generated",
    };
  }

  // Sort by pIC50 descending
  allCandidates.sort((a, b) => b.pic50 - a.pic50);
  const top10 = allCandidates.slice(0, 10);

  // Verify top 10 against public databases
  let verifiedCount = 0;
  for (const candidate of top10) {
    try {
      const verification = await verifyCandidatePublicDb(candidate.smiles, candidate.pic50);
      candidate.verified = verification.verified;
      candidate.verification_sources = verification.sources;
      if (verification.verified) verifiedCount++;
    } catch {
      // Non-fatal: verification failure doesn't invalidate the candidate
    }
  }

  // Compute ADMET pass rate for top 10
  const admetPassCount = top10.filter((c) => c.admet.passes).length;
  const admetPassRate = admetPassCount / top10.length;

  // Compute quantum scores for top 3
  const top3 = top10.slice(0, 3);
  for (const candidate of top3) {
    try {
      const qResult = await quantumScore(candidate.smiles, candidate.pic50);
      candidate.quantum_score = qResult.quantumScore;
    } catch {
      // Non-fatal
    }
  }

  const top10MeanPic50 = top10.reduce((s, c) => s + c.pic50, 0) / top10.length;
  const verificationRate = verifiedCount / top10.length;
  const best = top10[0];

  // ASI-Evolve eval_score formula
  // Fix 6: Use 1 decimal place instead of integer rounding for better score diversity
  const evalScore =
    Math.round((
      0.6 * top10MeanPic50 +
      0.3 * verificationRate * 10 + // scale 0-1 → 0-10
      0.1 * admetPassRate * 10      // scale 0-1 → 0-10
    ) * 10) / 10;

  return {
    eval_score: evalScore,
    success: true,
    top10_mean_pic50: top10MeanPic50,
    top10_verified_count: verifiedCount,
    best_pic50: best.pic50,
    best_smiles: best.smiles,
    admet_pass_rate: admetPassRate,
    track: best.track,
    quantum_score: best.quantum_score,
    top_candidates: top10,
  };
}
