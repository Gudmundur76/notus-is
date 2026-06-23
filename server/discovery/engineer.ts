/**
 * Multi-Track Molecule Engineer — TypeScript port of multi_track_engineer.py
 *
 * Implements 4 parallel discovery tracks:
 *   Track A: ChEMBL Top Actives (hydroxyethylamine scaffold modifications)
 *   Track B: PDB Co-Crystal Ligands (structure-guided P2/P2' group modifications)
 *   Track C: BindingDB Curated (bis-THF and carbamate variants)
 *   Track D: Diverse Scaffolds (fragment-based and macrocyclic exploration)
 *
 * Each track generates CANDIDATES_PER_TRACK candidates per cycle via
 * scaffold-aware SMILES mutation.
 */

import { TRACK_SEEDS } from "./corpus-data";
import {
  computeAdmet,
  generateFingerprint,
  isValidSmiles,
  tanimotoFromBits,
} from "./chemistry";
import type { AdmetResult } from "./chemistry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Track = "A" | "B" | "C" | "D";

export interface GeneratedCandidate {
  smiles: string;
  parentSmiles: string;
  track: Track;
  modificationType: string;
  admet: AdmetResult | null;
  isNovel: boolean;
  tanimotoToParent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const CANDIDATES_PER_TRACK = 50;
const NOVELTY_THRESHOLD = 0.85; // Tanimoto > this → not novel

// ─────────────────────────────────────────────────────────────────────────────
// SMILES mutation operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All modification types, mirroring the Python engine's modification_types dict.
 */
const MODIFICATION_TYPES: Record<string, string[]> = {
  // Halogen substitutions
  halogen_sub: [
    "F", "Cl", "Br", "I",
    "c1ccc(F)cc1", "c1ccc(Cl)cc1", "c1ccc(Br)cc1",
    "c1cc(F)ccc1F", "c1ccc(F)c(F)c1",
  ],
  // Methyl/ethyl additions
  alkyl_add: [
    "C", "CC", "CCC", "C(C)C",
    "CC(C)C", "CCCC",
  ],
  // Hydroxyl/methoxy additions
  polar_add: [
    "O", "OC", "OCC", "N", "NC",
    "C(=O)O", "C(=O)N",
  ],
  // Ring modifications
  ring_mod: [
    "c1ccccc1", "c1ccncc1", "c1ccoc1",
    "c1ccsc1", "C1CCCC1", "C1CCCCC1",
    "c1cncc1", "c1cncnc1",
  ],
  // Sulfonamide additions (key for HIV PI scaffold)
  sulfonamide: [
    "S(=O)(=O)N", "S(=O)(=O)NC",
    "NS(=O)(=O)c1ccc(N)cc1",
    "NS(=O)(=O)c1ccccc1",
  ],
  // Carbamate modifications
  carbamate: [
    "OC(=O)N", "NC(=O)O",
    "OC(=O)NC", "NC(=O)OC",
  ],
  // Bis-THF scaffold (Track C specific)
  bis_thf: [
    "C1COC2CCOC12", "C1CCOC1",
    "OC1COC2CCOC12",
  ],
  // Macrocycle elements (Track D specific)
  macrocycle: [
    "CCCCCC", "CCCCCCC", "CCCCCCCC",
    "C(=O)CCCC", "NC(=O)CCC",
  ],
};

/**
 * Deterministic pseudo-random number generator (seeded by cycle + index).
 * Ensures reproducibility across runs.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

/**
 * Mutate a SMILES string by appending, substituting, or inserting fragments.
 * Returns the mutated SMILES or null if the result is invalid.
 */
function mutateSMILES(
  smiles: string,
  modType: string,
  fragments: string[],
  rng: () => number
): string | null {
  if (!smiles || fragments.length === 0) return null;
  const fragment = fragments[Math.floor(rng() * fragments.length)];
  const op = Math.floor(rng() * 4);

  try {
    switch (op) {
      case 0:
        // Append fragment via single bond
        return `${smiles}.${fragment}`;
      case 1:
        // Insert fragment at a random position
        if (smiles.length < 4) return `${smiles}${fragment}`;
        const insertPos = Math.floor(rng() * (smiles.length - 2)) + 1;
        return smiles.slice(0, insertPos) + fragment + smiles.slice(insertPos);
      case 2:
        // Replace a terminal group
        const terminals = ["C", "N", "O", "F", "Cl", "Br"];
        for (const term of terminals) {
          if (smiles.endsWith(term)) {
            return smiles.slice(0, -term.length) + fragment;
          }
        }
        return smiles + fragment;
      case 3:
        // Wrap in a ring-closure pattern
        return `C1(${smiles})${fragment}1`;
      default:
        return smiles + fragment;
    }
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Track-specific generation strategies
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_MOD_TYPES: Record<Track, string[]> = {
  A: ["halogen_sub", "alkyl_add", "sulfonamide", "polar_add"],
  B: ["ring_mod", "polar_add", "carbamate", "halogen_sub"],
  C: ["bis_thf", "carbamate", "polar_add", "sulfonamide"],
  D: ["macrocycle", "ring_mod", "alkyl_add", "halogen_sub"],
};

/**
 * Generate candidates for a single track.
 * Returns up to CANDIDATES_PER_TRACK valid, novel candidates.
 */
async function generateTrackCandidates(
  track: Track,
  seeds: string[],
  cycleNumber: number,
  knownSmiles: Set<string>
): Promise<GeneratedCandidate[]> {
  const candidates: GeneratedCandidate[] = [];
  const modTypes = TRACK_MOD_TYPES[track];
  const rng = seededRandom(cycleNumber * 1000 + track.charCodeAt(0));

  let attempts = 0;
  const maxAttempts = CANDIDATES_PER_TRACK * 10;

  while (candidates.length < CANDIDATES_PER_TRACK && attempts < maxAttempts) {
    attempts++;

    // Pick a seed (cycle through seeds + previously generated candidates)
    const allSeeds =
      candidates.length > 0
        ? [...seeds, ...candidates.slice(-5).map(c => c.smiles)]
        : seeds;
    const parentSmiles = allSeeds[Math.floor(rng() * allSeeds.length)];

    // Pick a modification type
    const modType = modTypes[Math.floor(rng() * modTypes.length)];
    const fragments = MODIFICATION_TYPES[modType] || ["C"];

    // Generate mutated SMILES
    const mutated = mutateSMILES(parentSmiles, modType, fragments, rng);
    if (!mutated) continue;

    // Validate
    const valid = await isValidSmiles(mutated);
    if (!valid) continue;

    // Check novelty (not in known SMILES set)
    if (knownSmiles.has(mutated)) continue;

    // Compute Tanimoto to parent
    const fp1 = await generateFingerprint(parentSmiles);
    const fp2 = await generateFingerprint(mutated);
    let tanimotoToParent = 0;
    if (fp1 && fp2) {
      tanimotoToParent = tanimotoFromBits(fp1.fingerprintBits, fp2.fingerprintBits);
    }

    // Check novelty threshold (not too similar to parent)
    const isNovel = tanimotoToParent < NOVELTY_THRESHOLD;

    // Compute ADMET
    const admet = await computeAdmet(mutated);

    knownSmiles.add(mutated);
    candidates.push({
      smiles: mutated,
      parentSmiles,
      track,
      modificationType: modType,
      admet,
      isNovel,
      tanimotoToParent: Math.round(tanimotoToParent * 1000) / 1000,
    });
  }

  return candidates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main generation function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate candidates across all 4 tracks for a given cycle.
 * Returns up to 4 × CANDIDATES_PER_TRACK = 200 candidates.
 */
export async function generateAllTracks(
  cycleNumber: number,
  knownSmiles: Set<string>
): Promise<GeneratedCandidate[]> {
  const tracks: Track[] = ["A", "B", "C", "D"];

  // Run all 4 tracks in parallel
  const results = await Promise.all(
    tracks.map(track =>
      generateTrackCandidates(
        track,
        TRACK_SEEDS[track] || [],
        cycleNumber,
        knownSmiles
      )
    )
  );

  const all = results.flat();
  console.log(
    `[Engineer] Cycle ${cycleNumber}: generated ${all.length} candidates across 4 tracks`
  );
  return all;
}

/**
 * Filter candidates by drug-likeness (Lipinski rule-of-five).
 * Returns only drug-like candidates.
 */
export function filterDruglike(
  candidates: GeneratedCandidate[]
): GeneratedCandidate[] {
  return candidates.filter(c => c.admet?.isDruglike ?? false);
}

/**
 * Filter candidates by novelty (Tanimoto < threshold to parent).
 */
export function filterNovel(
  candidates: GeneratedCandidate[]
): GeneratedCandidate[] {
  return candidates.filter(c => c.isNovel);
}
