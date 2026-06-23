/**
 * ASI-Evolve Cognition Seeder
 * Seeds the cognition store with verified knowledge from public databases.
 * Runs at the start of each evolution run and refreshes every N steps.
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

import { addCognitionBatch, getCognitionCount } from "./cognition";
import {
  fetchPubMedRecords,
  fetchChEMBLRecords,
  fetchPDBRecords,
  fetchUniProtRecord,
  pubmedToCognitionContent,
  chemblToCognitionContent,
  pdbToCognitionContent,
  uniprotToCognitionContent,
} from "./public-db";
import type { CognitionItem } from "./types";

/**
 * Seed the cognition store from all public databases.
 * Idempotent: skips if already seeded (count > 0).
 * Per SKILL.md: "Seed cognition only with insight-like external knowledge
 * that is safe to reuse across rounds."
 */
export async function seedCognitionStore(
  runId: number,
  force: boolean = false
): Promise<{ added: number; sources: Record<string, number> }> {
  const existing = await getCognitionCount(runId);
  if (existing > 0 && !force) {
    console.log(`[Cognition] Already seeded with ${existing} items. Skipping.`);
    return { added: 0, sources: {} };
  }

  console.log("[Cognition] Seeding from public databases...");
  const items: Omit<CognitionItem, "id">[] = [];
  const sources: Record<string, number> = {};

  // 1. UniProt — HIV-1 protease protein data (seed once, very stable)
  try {
    const uniprot = await fetchUniProtRecord();
    if (uniprot) {
      items.push({
        run_id: runId,
        content: uniprotToCognitionContent(uniprot),
        source: "UniProt:P04585",
        source_type: "uniprot",
        embedding: [],
        created_at: Date.now(),
        metadata: { accession: uniprot.accession },
      });
      sources.uniprot = 1;
    }
  } catch (e) {
    console.warn("[Cognition] UniProt fetch failed:", e);
  }

  // 2. PubMed — HIV protease inhibitor literature
  try {
    const pubmedRecords = await fetchPubMedRecords(
      "HIV protease inhibitor pIC50 IC50 binding affinity crystal structure",
      15
    );
    for (const rec of pubmedRecords) {
      const content = pubmedToCognitionContent(rec);
      if (content.length > 50) {
        items.push({
          run_id: runId,
          content,
          source: `PubMed:${rec.pmid}`,
          source_type: "pubmed",
          embedding: [],
          created_at: Date.now(),
          metadata: { pmid: rec.pmid, year: rec.year, journal: rec.journal },
        });
      }
    }
    sources.pubmed = pubmedRecords.length;
  } catch (e) {
    console.warn("[Cognition] PubMed fetch failed:", e);
  }

  // 3. ChEMBL — HIV protease bioassay records
  try {
    const chemblRecords = await fetchChEMBLRecords(20);
    for (const rec of chemblRecords) {
      if (rec.pchembl_value >= 7.0) { // Only high-affinity compounds (pIC50 >= 7 = IC50 <= 100nM)
        items.push({
          run_id: runId,
          content: chemblToCognitionContent(rec),
          source: `ChEMBL:${rec.chembl_id}`,
          source_type: "chembl",
          embedding: [],
          created_at: Date.now(),
          metadata: {
            chembl_id: rec.chembl_id,
            smiles: rec.smiles,
            pchembl_value: rec.pchembl_value,
          },
        });
      }
    }
    sources.chembl = chemblRecords.length;
  } catch (e) {
    console.warn("[Cognition] ChEMBL fetch failed:", e);
  }

  // 4. PDB — HIV protease co-crystal structures
  try {
    const pdbRecords = await fetchPDBRecords(10);
    for (const rec of pdbRecords) {
      items.push({
        run_id: runId,
        content: pdbToCognitionContent(rec),
        source: `PDB:${rec.pdb_id}`,
        source_type: "pdb",
        embedding: [],
        created_at: Date.now(),
        metadata: { pdb_id: rec.pdb_id, resolution: rec.resolution },
      });
    }
    sources.pdb = pdbRecords.length;
  } catch (e) {
    console.warn("[Cognition] PDB fetch failed:", e);
  }

  // 5. Manual seed — key HIV protease inhibitor heuristics from literature
  const manualSeeds: string[] = [
    "HIV-1 protease is a homodimeric aspartyl protease. The catalytic dyad consists of Asp25 and Asp125. All approved inhibitors bind in the substrate-binding cleft and make hydrogen bonds with Asp25/Asp125.",
    "Lipinski's Rule of Five for HIV protease inhibitors: MW < 500, LogP < 5, HBD < 5, HBA < 10. Approved drugs (saquinavir, ritonavir, lopinavir) violate some rules but maintain oral bioavailability through formulation.",
    "The bis-THF (bis-tetrahydrofuran) P2 ligand in darunavir forms unique hydrogen bonds with Asp29 and Asp30 backbone amides, contributing to its exceptional potency (Ki = 4.5 pM) and resistance profile.",
    "P1' pocket of HIV protease accommodates hydrophobic groups. Phenyl, naphthyl, and cyclopentyl groups at P1' improve binding. The P2' position tolerates small polar groups.",
    "Flap region (residues 45-55) of HIV protease undergoes conformational change upon inhibitor binding. Flap water molecule mediates key hydrogen bonds between inhibitor and Ile50/Ile150.",
    "ADMET requirements for HIV protease inhibitors: TPSA < 140 Å², rotatable bonds < 10, MW < 700 (peptidomimetics can be larger), LogP 1-5 for membrane permeability.",
    "Resistance mutations in HIV protease: D30N, V32I, M46I/L, I47V/A, G48V, I50L/V, I54L/M/T/V, L76V, V82A/F/T/S, I84V, L90M. Darunavir maintains activity against most single mutations.",
    "Quantum chemistry calculations (DFT, QAOA-VQE) can predict binding free energies more accurately than classical force fields for HIV protease inhibitors. Correlation with experimental pIC50: r² > 0.8 for high-quality datasets.",
    "Scaffold hopping from hydroxyethylamine to hydroxyethylsulfonamide or cyclic urea maintains protease inhibition while improving metabolic stability. Tipranavir uses a dihydropyrone scaffold.",
    "Fragment-based drug design for HIV protease: fragments binding in P2 pocket (IC50 < 1mM) can be grown toward P1' to achieve nanomolar inhibitors. Key fragment: 4-aminobenzamide.",
  ];

  for (const content of manualSeeds) {
    items.push({
      run_id: runId,
      content,
      source: "manual:heuristics",
      source_type: "manual",
      embedding: [],
      created_at: Date.now(),
      metadata: {},
    });
  }
  sources.manual = manualSeeds.length;

  if (items.length > 0) {
    await addCognitionBatch(items);
    console.log(`[Cognition] Seeded ${items.length} items from:`, sources);
  }

  return { added: items.length, sources };
}

/**
 * Refresh cognition with new PubMed/ChEMBL records.
 * Called every 10 steps to keep the store current.
 */
export async function refreshCognitionStore(runId: number): Promise<number> {
  const newItems: Omit<CognitionItem, "id">[] = [];

  try {
    const pubmedRecords = await fetchPubMedRecords(
      "HIV protease inhibitor novel scaffold 2024 2025",
      5
    );
    for (const rec of pubmedRecords) {
      const content = pubmedToCognitionContent(rec);
      if (content.length > 50) {
        newItems.push({
          run_id: runId,
          content,
          source: `PubMed:${rec.pmid}`,
          source_type: "pubmed",
          embedding: [],
          created_at: Date.now(),
          metadata: { pmid: rec.pmid, year: rec.year },
        });
      }
    }
  } catch { /* non-fatal */ }

  if (newItems.length > 0) {
    await addCognitionBatch(newItems);
  }

  return newItems.length;
}
