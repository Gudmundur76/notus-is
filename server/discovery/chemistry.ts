/**
 * Chemistry Engine — TypeScript port of fingerprint.py + swissadme_client.py
 *
 * Uses @rdkit/rdkit (WASM) for:
 *   - Morgan fingerprint generation (ECFP4, radius=2, nbits=2048)
 *   - Tanimoto similarity
 *   - ADMET / Lipinski rule-of-five
 *   - SMILES validation and canonicalization
 *
 * RDKit API (verified against v2025.3.4):
 *   mol.get_morgan_fp()              → 2048-char binary string ('0'/'1')
 *   mol.get_morgan_fp_as_uint8array() → Uint8Array of 256 bytes (2048 bits)
 *   mol.get_descriptors()            → JSON string with exactmw, CrippenClogP, NumHBD, NumHBA, tpsa, etc.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RDKitMol = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RDKitModule = any;

let rdkitModule: RDKitModule | null = null;
let rdkitInitialising = false;
let rdkitReady = false;

/** Lazy-init the RDKit WASM module (server-side, Node.js). */
async function getRDKit(): Promise<RDKitModule | null> {
  if (rdkitReady) return rdkitModule;
  if (rdkitInitialising) {
    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        if (rdkitReady || !rdkitInitialising) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
    return rdkitModule;
  }
  rdkitInitialising = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rdkitPkg = require("@rdkit/rdkit");
    const initRDKit = rdkitPkg.default ?? rdkitPkg;
    rdkitModule = await initRDKit();
    rdkitReady = true;
    console.log("[Chemistry] RDKit WASM initialised");
  } catch (err) {
    console.warn("[Chemistry] RDKit WASM init failed:", err);
    rdkitModule = null;
    rdkitReady = true;
  } finally {
    rdkitInitialising = false;
  }
  return rdkitModule;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FingerprintResult {
  smiles: string;
  canonicalSmiles: string;
  fingerprint: Uint8Array; // 256 bytes = 2048 bits (packed)
  fingerprintBits: number[]; // Indices of set bits (sparse)
  isValid: boolean;
}

export interface AdmetResult {
  mw: number;
  logp: number;
  hbd: number;
  hba: number;
  tpsa: number;
  lipinskiViolations: number;
  isDruglike: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fingerprint generation
// ─────────────────────────────────────────────────────────────────────────────

const FINGERPRINT_NBITS = 2048;

/**
 * Generate a Morgan (ECFP4) fingerprint for a SMILES string.
 * Returns null if the SMILES is invalid.
 */
export async function generateFingerprint(
  smiles: string
): Promise<FingerprintResult | null> {
  const rdkit = await getRDKit();

  if (rdkit) {
    let mol: RDKitMol | null = null;
    try {
      mol = rdkit.get_mol(smiles);
      if (!mol || !mol.is_valid()) return null;

      const canonical: string = mol.get_smiles();

      // get_morgan_fp() returns a 2048-char binary string ('0'/'1')
      const fpStr: string = mol.get_morgan_fp();
      const bits: number[] = [];
      const packed = new Uint8Array(Math.ceil(FINGERPRINT_NBITS / 8));
      for (let i = 0; i < fpStr.length && i < FINGERPRINT_NBITS; i++) {
        if (fpStr[i] === "1") {
          bits.push(i);
          packed[Math.floor(i / 8)] |= 1 << (i % 8);
        }
      }
      return {
        smiles,
        canonicalSmiles: canonical,
        fingerprint: packed,
        fingerprintBits: bits,
        isValid: true,
      };
    } catch {
      return null;
    } finally {
      if (mol) {
        try { mol.delete(); } catch { /* ignore */ }
      }
    }
  }

  // Fallback: hash-based fingerprint when RDKit is unavailable
  return generateFingerprintFallback(smiles);
}

/** Deterministic hash-based fingerprint fallback (no RDKit). */
function generateFingerprintFallback(smiles: string): FingerprintResult | null {
  if (!smiles || smiles.trim().length === 0) return null;
  // Simple hash-based fingerprint using substrings
  const bits: number[] = [];
  const packed = new Uint8Array(Math.ceil(FINGERPRINT_NBITS / 8));
  for (let len = 1; len <= Math.min(smiles.length, 8); len++) {
    for (let start = 0; start <= smiles.length - len; start++) {
      const sub = smiles.substring(start, start + len);
      let hash = 0;
      for (let k = 0; k < sub.length; k++) {
        hash = (hash * 31 + sub.charCodeAt(k)) & 0x7fffffff;
      }
      const bit = hash % FINGERPRINT_NBITS;
      if (!bits.includes(bit)) {
        bits.push(bit);
        packed[Math.floor(bit / 8)] |= 1 << (bit % 8);
      }
    }
  }
  return {
    smiles,
    canonicalSmiles: smiles,
    fingerprint: packed,
    fingerprintBits: bits,
    isValid: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tanimoto similarity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute Tanimoto similarity between two SMILES strings.
 * Returns 0.0 if either is invalid.
 */
export async function tanimotoSimilarity(
  smiles1: string,
  smiles2: string
): Promise<number> {
  const [fp1, fp2] = await Promise.all([
    generateFingerprint(smiles1),
    generateFingerprint(smiles2),
  ]);
  if (!fp1 || !fp2) return 0.0;
  return tanimotoFromBits(fp1.fingerprintBits, fp2.fingerprintBits);
}

/** Tanimoto from two arrays of set-bit indices. */
export function tanimotoFromBits(bits1: number[], bits2: number[]): number {
  const set1 = new Set<number>(bits1);
  const set2 = new Set<number>(bits2);
  let intersection = 0;
  bits1.forEach(b => { if (set2.has(b)) intersection++; });
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0.0 : intersection / union;
}

/**
 * Compute maximum Tanimoto similarity of a SMILES against a list of reference SMILES.
 */
export async function maxTanimotoToList(
  smiles: string,
  referenceSmilesList: string[]
): Promise<number> {
  const fp = await generateFingerprint(smiles);
  if (!fp) return 0.0;
  let maxSim = 0.0;
  for (const refSmiles of referenceSmilesList) {
    const refFp = await generateFingerprint(refSmiles);
    if (!refFp) continue;
    const sim = tanimotoFromBits(fp.fingerprintBits, refFp.fingerprintBits);
    if (sim > maxSim) maxSim = sim;
  }
  return maxSim;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMET / Lipinski Rule-of-Five
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute ADMET properties and Lipinski rule-of-five violations.
 * Port of swissadme_client.py + inline ADMET checks in multi_track_engineer.py.
 */
export async function computeAdmet(smiles: string): Promise<AdmetResult | null> {
  const rdkit = await getRDKit();

  if (rdkit) {
    let mol: RDKitMol | null = null;
    try {
      mol = rdkit.get_mol(smiles);
      if (!mol || !mol.is_valid()) return null;

      const desc = JSON.parse(mol.get_descriptors()) as Record<string, number>;

      const mw: number = desc.exactmw ?? desc.amw ?? 0;
      const logp: number = desc.CrippenClogP ?? 0;
      const hbd: number = desc.NumHBD ?? desc.lipinskiHBD ?? 0;
      const hba: number = desc.NumHBA ?? desc.lipinskiHBA ?? 0;
      const tpsa: number = desc.tpsa ?? 0;

      let violations = 0;
      if (mw > 500) violations++;
      if (logp > 5) violations++;
      if (hbd > 5) violations++;
      if (hba > 10) violations++;

      return {
        mw: Math.round(mw * 100) / 100,
        logp: Math.round(logp * 100) / 100,
        hbd,
        hba,
        tpsa: Math.round(tpsa * 100) / 100,
        lipinskiViolations: violations,
        isDruglike: violations <= 1,
      };
    } catch {
      return null;
    } finally {
      if (mol) {
        try { mol.delete(); } catch { /* ignore */ }
      }
    }
  }

  // Fallback: heuristic estimation from SMILES string
  return estimateAdmetFromSmiles(smiles);
}

function estimateAdmetFromSmiles(smiles: string): AdmetResult {
  const heavyAtoms = (smiles.match(/[A-Z]/g) || []).length;
  const mw = heavyAtoms * 12.5;
  const logp =
    (smiles.match(/[cC]/g) || []).length * 0.3 -
    (smiles.match(/[ON]/g) || []).length * 0.5;
  const hbd = (smiles.match(/\[NH\]|\[OH\]|NH|OH/g) || []).length;
  const hba = (smiles.match(/[ON]/g) || []).length;
  const tpsa = hbd * 20 + hba * 10;

  let violations = 0;
  if (mw > 500) violations++;
  if (logp > 5) violations++;
  if (hbd > 5) violations++;
  if (hba > 10) violations++;

  return {
    mw: Math.round(mw * 100) / 100,
    logp: Math.round(logp * 100) / 100,
    hbd,
    hba,
    tpsa: Math.round(tpsa * 100) / 100,
    lipinskiViolations: violations,
    isDruglike: violations <= 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SMILES validation and canonicalization
// ─────────────────────────────────────────────────────────────────────────────

/** Returns canonical SMILES or null if invalid. */
export async function canonicalize(smiles: string): Promise<string | null> {
  const rdkit = await getRDKit();
  if (rdkit) {
    let mol: RDKitMol | null = null;
    try {
      mol = rdkit.get_mol(smiles);
      if (!mol || !mol.is_valid()) return null;
      return mol.get_smiles() as string;
    } catch {
      return null;
    } finally {
      if (mol) {
        try { mol.delete(); } catch { /* ignore */ }
      }
    }
  }
  return smiles;
}

/** Returns true if the SMILES is chemically valid. */
export async function isValidSmiles(smiles: string): Promise<boolean> {
  if (!smiles || smiles.trim().length === 0) return false;
  const canonical = await canonicalize(smiles);
  return canonical !== null;
}
