/**
 * server/discovery/domain-configs.ts
 *
 * Maps each DomainId to its full DomainConfig: which adapters to query,
 * which citation vertical to use, how to score results, and which cognition
 * seed queries to inject at cycle start.
 *
 * Adapter names must match the keys registered in the Python discovery engine's
 * 65-source registry (python-bridge.ts --domains flag).
 */

import type { DomainConfig, DomainId } from "../../shared/types/domain.js";

// ── Domain configurations ─────────────────────────────────────────────────────

export const DOMAIN_CONFIGS: Record<DomainId, DomainConfig> = {
  // ── Biomedical ──────────────────────────────────────────────────────────────
  biomedical: {
    id: "biomedical",
    name: "Biomedical",
    adapters: [
      "pubchem", "chembl", "europe_pmc", "biorxiv", "cochrane",
      "uniprot", "pdb", "bindingdb", "drugbank", "opentargets",
    ],
    verificationVertical: "biomedical_literature",
    scoringStrategy: "molecular",
    cognitionSeedQueries: [
      "HIV-1 protease inhibitor binding affinity",
      "drug resistance mutation patterns",
      "non-peptidic scaffold design",
    ],
    quantumEnabled: true,
  },

  // ── Molecular ───────────────────────────────────────────────────────────────
  molecular: {
    id: "molecular",
    name: "Molecular",
    adapters: [
      "pubchem", "chembl", "bindingdb", "zinc", "enamine",
      "mcule", "molport", "emolecules", "stdinchi", "chebi",
    ],
    verificationVertical: "structural_biology",
    scoringStrategy: "molecular",
    cognitionSeedQueries: [
      "small molecule binding affinity IC50 Ki",
      "SMILES scaffold optimisation Lipinski",
      "ADMET drug-like properties",
    ],
    quantumEnabled: true,
  },

  // ── Protein ─────────────────────────────────────────────────────────────────
  protein: {
    id: "protein",
    name: "Protein",
    adapters: [
      "uniprot", "pdb", "alphafold", "pfam", "interpro",
      "string_db", "biogrid", "intact", "reactome", "kegg",
    ],
    verificationVertical: "structural_biology",
    scoringStrategy: "molecular",
    cognitionSeedQueries: [
      "protein folding prediction AlphaFold",
      "protein-protein interaction network",
      "enzyme active site catalytic mechanism",
    ],
    quantumEnabled: true,
  },

  // ── Clinical ────────────────────────────────────────────────────────────────
  clinical: {
    id: "clinical",
    name: "Clinical",
    adapters: [
      "clinicaltrials", "fda_drugs", "fda_devices", "ema", "who_ictrp",
      "pubmed", "cochrane", "europe_pmc", "medrxiv", "nct",
    ],
    verificationVertical: "clinical_evidence",
    scoringStrategy: "text",
    cognitionSeedQueries: [
      "randomised controlled trial efficacy primary endpoint",
      "FDA approval pathway NDA BLA",
      "adverse event safety signal pharmacovigilance",
    ],
    quantumEnabled: false,
  },

  // ── Climate ─────────────────────────────────────────────────────────────────
  climate: {
    id: "climate",
    name: "Climate",
    adapters: [
      "ipcc", "noaa", "nasa_earthdata", "eea", "epa",
      "usgs", "owid", "copernicus", "wmo", "iea",
    ],
    verificationVertical: "climate_science",
    scoringStrategy: "numeric",
    cognitionSeedQueries: [
      "global temperature anomaly trends 2020-2030",
      "carbon emission reduction strategies",
      "ocean acidification impact assessment",
    ],
    quantumEnabled: false,
  },

  // ── Economics ───────────────────────────────────────────────────────────────
  economics: {
    id: "economics",
    name: "Economics",
    adapters: [
      "world_bank", "imf", "oecd", "fred", "eurostat",
      "bis", "un_comtrade", "wto", "unctad", "owid",
    ],
    verificationVertical: "economic_indicators",
    scoringStrategy: "economic",
    cognitionSeedQueries: [
      "GDP growth inflation monetary policy",
      "trade balance current account deficit",
      "fiscal multiplier government spending",
    ],
    quantumEnabled: false,
  },

  // ── Law ─────────────────────────────────────────────────────────────────────
  law: {
    id: "law",
    name: "Law",
    adapters: [
      "eur_lex", "federal_register", "cfr", "echr", "icj",
      "wipo", "ustr", "sec_edgar", "caselaw_access", "courtlistener",
    ],
    verificationVertical: "legal_text",
    scoringStrategy: "text",
    cognitionSeedQueries: [
      "regulation compliance statute enforcement",
      "case law precedent judicial interpretation",
      "international treaty obligation ratification",
    ],
    quantumEnabled: false,
  },

  // ── Energy ──────────────────────────────────────────────────────────────────
  energy: {
    id: "energy",
    name: "Energy",
    adapters: [
      "iea", "eia", "irena", "nrel", "ember",
      "entso_e", "open_power_system", "energy_charts", "owid", "bp_stats",
    ],
    verificationVertical: "energy_data",
    scoringStrategy: "numeric",
    cognitionSeedQueries: [
      "renewable energy capacity solar wind LCOE",
      "grid stability storage battery technology",
      "energy transition decarbonisation pathway",
    ],
    quantumEnabled: false,
  },

  // ── Nutrition ───────────────────────────────────────────────────────────────
  nutrition: {
    id: "nutrition",
    name: "Nutrition",
    adapters: [
      "usda_fdc", "efsa", "pubmed", "cochrane", "europe_pmc",
      "openfoodfacts", "nutritionix", "fao", "who_nutrition", "examine_db",
    ],
    verificationVertical: "nutrition_science",
    scoringStrategy: "text",
    cognitionSeedQueries: [
      "dietary supplement bioavailability absorption",
      "macronutrient protein carbohydrate fat metabolism",
      "micronutrient deficiency intervention RCT",
    ],
    quantumEnabled: false,
  },

  // ── Materials ───────────────────────────────────────────────────────────────
  materials: {
    id: "materials",
    name: "Materials",
    adapters: [
      "materials_project", "aflow", "oqmd", "icsd", "nomad",
      "springer_materials", "crystallography_open", "cod", "jarvis", "mpds",
    ],
    verificationVertical: "materials_science",
    scoringStrategy: "numeric",
    cognitionSeedQueries: [
      "crystal structure bandgap semiconductor properties",
      "perovskite solar cell efficiency stability",
      "battery cathode material energy density",
    ],
    quantumEnabled: true,
  },

  // ── Knowledge ───────────────────────────────────────────────────────────────
  knowledge: {
    id: "knowledge",
    name: "Knowledge",
    adapters: [
      "ietf_rfc", "w3c", "iso_standards", "nist", "ansi",
      "ieee_xplore", "arxiv", "zenodo", "figshare", "dryad",
    ],
    verificationVertical: "technical_standards",
    scoringStrategy: "text",
    cognitionSeedQueries: [
      "technical standard protocol specification RFC",
      "open standard interoperability API design",
      "best practice guideline recommendation",
    ],
    quantumEnabled: false,
  },

  // ── Citation ────────────────────────────────────────────────────────────────
  citation: {
    id: "citation",
    name: "Citation",
    adapters: [
      "crossref", "semantic_scholar", "openalex", "unpaywall", "core_ac",
      "arxiv", "europe_pmc", "pubmed", "biorxiv", "medrxiv",
    ],
    verificationVertical: "citation_network",
    scoringStrategy: "text",
    cognitionSeedQueries: [
      "highly cited paper research impact h-index",
      "citation network bibliometric analysis",
      "open access publication preprint",
    ],
    quantumEnabled: false,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the DomainConfig for a given id, throwing if unknown */
export function getDomainConfig(id: DomainId): DomainConfig {
  const config = DOMAIN_CONFIGS[id];
  if (!config) throw new Error(`No domain config for id: ${id}`);
  return config;
}

/** All domain configs as an ordered array (preserves DOMAINS order) */
export const ALL_DOMAIN_CONFIGS: DomainConfig[] = Object.values(DOMAIN_CONFIGS);
