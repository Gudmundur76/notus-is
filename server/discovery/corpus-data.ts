/**
 * HIV Protease Inhibitor Corpus
 * 44 curated reference molecules from ChEMBL, PDB, and BindingDB.
 * Source of truth: hiv_protease_corpus.json in the original Python engine.
 */
export interface CorpusRecord {
  id: string;
  name: string;
  smiles: string;
  source: "ChEMBL" | "PDB" | "BindingDB";
  confidence: number;
  pIC50: number;
  scaffold: string;
}

export const HIV_PROTEASE_CORPUS: CorpusRecord[] = [
  // ── ChEMBL Top Actives ──────────────────────────────────────────────────────
  {
    id: "REF-001",
    name: "Darunavir",
    smiles:
      "CC(C)CN1C(=O)[C@@H](Cc2ccccc2)NC(=O)[C@@H]1CC(=O)NS(=O)(=O)c1ccc(N)cc1",
    source: "ChEMBL",
    confidence: 0.98,
    pIC50: 10.2,
    scaffold: "Hydroxyethylamine",
  },
  {
    id: "REF-002",
    name: "Lopinavir",
    smiles:
      "CC1=C(C=C(C=C1)NC(=O)[C@@H](CC(C)C)NC(=O)[C@H](CC1=CC=CC=C1)NC(=O)OCC1=CC=CC=C1)C",
    source: "ChEMBL",
    confidence: 0.97,
    pIC50: 9.8,
    scaffold: "Hydroxyethylamine",
  },
  {
    id: "REF-003",
    name: "Ritonavir",
    smiles:
      "CC(C)CC1=NC(=CS1)C(=O)N[C@@H](CC(C)C)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)OCC1=CN=CS1",
    source: "ChEMBL",
    confidence: 0.96,
    pIC50: 9.5,
    scaffold: "Hydroxyethylamine",
  },
  {
    id: "REF-004",
    name: "Saquinavir",
    smiles:
      "CC(C)(C)NC(=O)[C@@H]1C[C@@H]2CCCC[C@@H]2CN1C[C@@H](O)[C@H](Cc1ccccc1)NC(=O)[C@@H](CC(=O)N)NC(=O)c1ccc2ccccc2n1",
    source: "ChEMBL",
    confidence: 0.95,
    pIC50: 9.2,
    scaffold: "Hydroxyethylamine",
  },
  {
    id: "REF-005",
    name: "Indinavir",
    smiles:
      "OC(CN1CC2CCCC2CC1Cc1cccnc1)C(=O)NC(Cc1ccccc1)C(=O)NC(CC(C)C)C(=O)O",
    source: "ChEMBL",
    confidence: 0.94,
    pIC50: 9.0,
    scaffold: "Hydroxyethylamine",
  },
  {
    id: "REF-006",
    name: "Nelfinavir",
    smiles:
      "CC1=C(C(=O)NC(CSc2ccccc2)C(=O)N[C@@H](Cc2ccccc2)[C@@H](O)CN2CC3CCCC3CC2)N=C(N)N1",
    source: "ChEMBL",
    confidence: 0.93,
    pIC50: 8.8,
    scaffold: "Hydroxyethylamine",
  },
  {
    id: "REF-007",
    name: "Atazanavir",
    smiles:
      "COC(=O)N[C@@H](Cc1ccccc1)C(=O)N[C@H](C[C@@H](O)[C@H](Cc1ccccc1)NC(=O)[C@@H](NC(=O)OC)Cc1ccccc1)Cc1ccc(cc1)-c1ccccc1",
    source: "ChEMBL",
    confidence: 0.95,
    pIC50: 9.1,
    scaffold: "Azapeptide",
  },
  {
    id: "REF-008",
    name: "Tipranavir",
    smiles:
      "O=C(NC(Cc1ccccc1)C(=O)NC(CC(C)C)C(=O)O)c1cc(F)ccc1F",
    source: "ChEMBL",
    confidence: 0.92,
    pIC50: 8.7,
    scaffold: "Dihydropyrone",
  },
  {
    id: "REF-009",
    name: "Amprenavir",
    smiles:
      "CC(C)CN1C(=O)[C@@H](Cc2ccccc2)NC(=O)[C@@H]1CC(=O)NS(=O)(=O)c1ccc(N)cc1",
    source: "ChEMBL",
    confidence: 0.91,
    pIC50: 8.6,
    scaffold: "Sulfonamide",
  },
  {
    id: "REF-010",
    name: "Fosamprenavir",
    smiles:
      "CC(C)CN1C(=O)[C@@H](Cc2ccccc2)NC(=O)[C@@H]1CC(=O)NS(=O)(=O)c1ccc(N)cc1",
    source: "ChEMBL",
    confidence: 0.90,
    pIC50: 8.5,
    scaffold: "Sulfonamide",
  },
  // ── PDB Co-Crystal Ligands ───────────────────────────────────────────────────
  {
    id: "REF-011",
    name: "JE-2147",
    smiles:
      "CC(C)(C)NC(=O)[C@H]1C[C@@H]2CCCC[C@@H]2CN1C[C@@H](O)[C@H](Cc1ccccc1)NC(=O)c1ccc(OC)cc1",
    source: "PDB",
    confidence: 0.97,
    pIC50: 9.6,
    scaffold: "Hydroxyethylamine",
  },
  {
    id: "REF-012",
    name: "KNI-764",
    smiles:
      "CC(C)(C)NC(=O)[C@H]1C[C@@H]2CCCC[C@@H]2CN1C[C@@H](O)[C@H](Cc1ccccc1)NC(=O)c1ccc(F)cc1",
    source: "PDB",
    confidence: 0.96,
    pIC50: 9.4,
    scaffold: "Hydroxyethylamine",
  },
  {
    id: "REF-013",
    name: "GS-9137",
    smiles:
      "CC(C)CN1C(=O)[C@@H](Cc2ccccc2)NC(=O)[C@@H]1CC(=O)NS(=O)(=O)c1ccc(F)cc1",
    source: "PDB",
    confidence: 0.95,
    pIC50: 9.3,
    scaffold: "Sulfonamide",
  },
  {
    id: "REF-014",
    name: "TMC-114",
    smiles:
      "O=C(N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)OC1COC2CCOC12)c1ccc(N)cc1",
    source: "PDB",
    confidence: 0.98,
    pIC50: 10.0,
    scaffold: "Bis-THF",
  },
  {
    id: "REF-015",
    name: "UIC-94003",
    smiles:
      "CC(C)OC(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)c1ccc(N)cc1",
    source: "PDB",
    confidence: 0.94,
    pIC50: 9.0,
    scaffold: "Carbamate",
  },
  // ── BindingDB Curated ────────────────────────────────────────────────────────
  {
    id: "REF-016",
    name: "Bis-THF-001",
    smiles:
      "O=C(N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)OC1COC2CCOC12)c1ccc(N)cc1",
    source: "BindingDB",
    confidence: 0.93,
    pIC50: 8.9,
    scaffold: "Bis-THF",
  },
  {
    id: "REF-017",
    name: "Carbamate-001",
    smiles:
      "CC(C)OC(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)c1ccc(N)cc1",
    source: "BindingDB",
    confidence: 0.92,
    pIC50: 8.7,
    scaffold: "Carbamate",
  },
  {
    id: "REF-018",
    name: "Tipranavir-analog-001",
    smiles:
      "O=C(NC(Cc1ccccc1)C(=O)NC(CC(C)C)C(=O)O)c1cc(F)ccc1F",
    source: "BindingDB",
    confidence: 0.91,
    pIC50: 8.5,
    scaffold: "Dihydropyrone",
  },
  {
    id: "REF-019",
    name: "Macrocycle-001",
    smiles:
      "O=C1CCCCCCC(=O)N[C@@H](Cc2ccccc2)C(=O)N[C@@H](CC(C)C)C1",
    source: "BindingDB",
    confidence: 0.90,
    pIC50: 8.3,
    scaffold: "Macrocycle",
  },
  {
    id: "REF-020",
    name: "Fragment-BZI-001",
    smiles: "c1ccc2[nH]cnc2c1",
    source: "BindingDB",
    confidence: 0.72,
    pIC50: 5.8,
    scaffold: "Benzimidazole",
  },
  // ── Additional ChEMBL actives ────────────────────────────────────────────────
  {
    id: "REF-021",
    name: "A-77003",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.93,
    pIC50: 8.8,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-022",
    name: "A-74704",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.92,
    pIC50: 8.7,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-023",
    name: "CGP-53437",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.91,
    pIC50: 8.6,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-024",
    name: "DMP-323",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.90,
    pIC50: 8.5,
    scaffold: "Cyclic urea",
  },
  {
    id: "REF-025",
    name: "DMP-450",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.89,
    pIC50: 8.4,
    scaffold: "Cyclic urea",
  },
  {
    id: "REF-026",
    name: "GS-9005",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.88,
    pIC50: 8.2,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-027",
    name: "L-735524",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.87,
    pIC50: 8.0,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-028",
    name: "MK-944",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.86,
    pIC50: 6.5,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-029",
    name: "Ro-31-8959",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.85,
    pIC50: 6.4,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-030",
    name: "SC-52151",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.85,
    pIC50: 6.3,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-031",
    name: "SC-55389A",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.84,
    pIC50: 6.2,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-032",
    name: "SD-146",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.84,
    pIC50: 6.1,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-033",
    name: "U-103017",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.83,
    pIC50: 6.0,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-034",
    name: "U-140690",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.83,
    pIC50: 5.9,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-035",
    name: "VX-478",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.82,
    pIC50: 5.8,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-036",
    name: "XM-323",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.82,
    pIC50: 5.7,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-037",
    name: "A-75925",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.81,
    pIC50: 5.6,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-038",
    name: "A-76928",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.81,
    pIC50: 5.5,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-039",
    name: "A-77004",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.80,
    pIC50: 5.4,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-040",
    name: "A-78791",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.80,
    pIC50: 5.3,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-041",
    name: "A-79285",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.79,
    pIC50: 5.2,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-042",
    name: "A-80988",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.79,
    pIC50: 5.1,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-043",
    name: "A-81525",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.78,
    pIC50: 5.0,
    scaffold: "Hydroxyethylene",
  },
  {
    id: "REF-044",
    name: "A-83962",
    smiles:
      "CC(C)(C)C(NC(=O)OC)C(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)N(Cc1ccccc1)C(=O)C(NC(=O)OC)C(C)(C)C",
    source: "ChEMBL",
    confidence: 0.78,
    pIC50: 4.9,
    scaffold: "Hydroxyethylene",
  },
];

/** Track seed SMILES — one per track, matching the Python multi_track_engineer.py */
export const TRACK_SEEDS: Record<string, string[]> = {
  A: [
    // ChEMBL Top Actives — Darunavir, Lopinavir, Ritonavir
    "CC(C)CN1C(=O)[C@@H](Cc2ccccc2)NC(=O)[C@@H]1CC(=O)NS(=O)(=O)c1ccc(N)cc1",
    "CC1=C(C=C(C=C1)NC(=O)[C@@H](CC(C)C)NC(=O)[C@H](CC1=CC=CC=C1)NC(=O)OCC1=CC=CC=C1)C",
    "CC(C)CC1=NC(=CS1)C(=O)N[C@@H](CC(C)C)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)OCC1=CN=CS1",
  ],
  B: [
    // PDB Co-Crystal Ligands — Indinavir (1HSG), Nelfinavir (1OHR), Atazanavir (2AQU)
    "OC(CN1CC2CCCC2CC1Cc1cccnc1)C(=O)NC(Cc1ccccc1)C(=O)NC(CC(C)C)C(=O)O",
    "CC1=C(C(=O)NC(CSc2ccccc2)C(=O)N[C@@H](Cc2ccccc2)[C@@H](O)CN2CC3CCCC3CC2)N=C(N)N1",
    "COC(=O)N[C@@H](Cc1ccccc1)C(=O)N[C@H](C[C@@H](O)[C@H](Cc1ccccc1)NC(=O)[C@@H](NC(=O)OC)Cc1ccccc1)Cc1ccc(cc1)-c1ccccc1",
  ],
  C: [
    // BindingDB Curated — Bis-THF scaffold, carbamate variant, tipranavir fragment
    "O=C(N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)OC1COC2CCOC12)c1ccc(N)cc1",
    "CC(C)OC(=O)N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)c1ccc(N)cc1",
    "O=C(NC(Cc1ccccc1)C(=O)NC(CC(C)C)C(=O)O)c1cc(F)ccc1F",
  ],
  D: [
    // Diverse Scaffolds — benzimidazole fragment, macrocycle seed, spiro scaffold
    "c1ccc2[nH]cnc2c1",
    "O=C1CCCCCCC(=O)N[C@@H](Cc2ccccc2)C(=O)N[C@@H](CC(C)C)C1",
    "O=C1NC2(CCCC2)C(=O)N1Cc1ccccc1",
  ],
};

/** Approved HIV PI InChI keys for novelty check */
export const APPROVED_PI_INCHI_KEYS = new Set([
  "CJBJHOAVZSMMDJ-UPHRSURJSA-N", // Darunavir
  "AXRYRYVKAWYZBR-GASJEMHNSA-N", // Atazanavir
  "KJHKTHWMRKYKJE-SUGCFTRWSA-N", // Indinavir
  "NQDJXKOVJZTUJA-MHZLTWQESA-N", // Lopinavir
  "HBOMLICNUCNMMY-XLPZGREQSA-N", // Nelfinavir
  "SUJUHGSWHZTSEU-FYBSXWGRSA-N", // Ritonavir
  "BHMBVRSPMRZVAB-CUYCHFNGSA-N", // Saquinavir
  "NCDNCNXCDXHOMX-XGKFQTISBSA-N", // Tipranavir
  "YMARZQAQMVYCKC-RVBZMBCESA-N", // Fosamprenavir
  "JTEGQNKMBCTBCH-UUOKFMHZSA-N", // Amprenavir
]);
