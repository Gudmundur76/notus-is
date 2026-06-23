/**
 * shared/types/domain.ts
 *
 * Central domain definitions used by both client and server.
 * Import from this file on both sides — never duplicate these constants.
 */

// ── Domain catalogue ──────────────────────────────────────────────────────────

export const DOMAINS = [
  {
    id: "biomedical",
    name: "Biomedical",
    icon: "dna",
    quantumEligible: true,
    defaultQuery: "drug discovery disease treatment",
    description: "Drug discovery, disease treatment, and biomedical research",
  },
  {
    id: "molecular",
    name: "Molecular",
    icon: "atom",
    quantumEligible: true,
    defaultQuery: "compound binding affinity SMILES",
    description: "Small molecule chemistry, binding affinity, and SMILES-based analysis",
  },
  {
    id: "protein",
    name: "Protein",
    icon: "protein",
    quantumEligible: true,
    defaultQuery: "protein folding structure function",
    description: "Protein structure prediction, folding, and functional annotation",
  },
  {
    id: "clinical",
    name: "Clinical",
    icon: "stethoscope",
    quantumEligible: false,
    defaultQuery: "clinical trial FDA efficacy safety",
    description: "Clinical trials, regulatory submissions, and patient outcomes",
  },
  {
    id: "climate",
    name: "Climate",
    icon: "cloud-sun",
    quantumEligible: false,
    defaultQuery: "climate change carbon emissions temperature",
    description: "Climate science, emissions data, and environmental indicators",
  },
  {
    id: "economics",
    name: "Economics",
    icon: "trending-up",
    quantumEligible: false,
    defaultQuery: "GDP inflation trade fiscal policy",
    description: "Macroeconomic indicators, trade flows, and fiscal policy analysis",
  },
  {
    id: "law",
    name: "Law",
    icon: "scale",
    quantumEligible: false,
    defaultQuery: "regulation compliance statute litigation",
    description: "Legal statutes, regulatory compliance, and case law",
  },
  {
    id: "energy",
    name: "Energy",
    icon: "zap",
    quantumEligible: false,
    defaultQuery: "renewable solar wind electricity grid",
    description: "Renewable energy, grid infrastructure, and power generation",
  },
  {
    id: "nutrition",
    name: "Nutrition",
    icon: "apple",
    quantumEligible: false,
    defaultQuery: "protein supplement nutrient diet bioavailability",
    description: "Nutritional science, dietary supplements, and bioavailability",
  },
  {
    id: "materials",
    name: "Materials",
    icon: "gem",
    quantumEligible: true,
    defaultQuery: "material crystal bandgap semiconductor",
    description: "Materials science, crystal structures, and semiconductor properties",
  },
  {
    id: "knowledge",
    name: "Knowledge",
    icon: "book-open",
    quantumEligible: false,
    defaultQuery: "standard protocol specification RFC",
    description: "Technical standards, protocols, and specification documents",
  },
  {
    id: "citation",
    name: "Citation",
    icon: "quote",
    quantumEligible: false,
    defaultQuery: "paper publication citation bibliometrics",
    description: "Academic publications, citation networks, and bibliometrics",
  },
] as const;

// ── Derived types ─────────────────────────────────────────────────────────────

export type DomainId = (typeof DOMAINS)[number]["id"];

export type DomainMeta = (typeof DOMAINS)[number];

/** Scoring strategy determines how raw discovery results are ranked */
export type ScoringStrategy = "molecular" | "economic" | "text" | "numeric";

// ── Runtime configuration (server-side) ──────────────────────────────────────

export interface DomainConfig {
  /** Matches a DomainId from DOMAINS */
  id: DomainId;
  name: string;
  /** Subset of the 65 registered adapters to query for this domain */
  adapters: string[];
  /** citation.manus.space vertical name for verification */
  verificationVertical: string;
  /** How to score raw discovery results */
  scoringStrategy: ScoringStrategy;
  /** Initial queries seeded into evolve_cognition at cycle start */
  cognitionSeedQueries: string[];
  /** Whether to run quantum VQE scoring in Phase 2 */
  quantumEnabled: boolean;
}

// ── Helper utilities ──────────────────────────────────────────────────────────

/** Returns the DOMAINS entry for a given id, or undefined */
export function getDomainMeta(id: DomainId): DomainMeta {
  const entry = DOMAINS.find((d) => d.id === id);
  if (!entry) throw new Error(`Unknown domain id: ${id}`);
  return entry;
}

/** All domain IDs as a plain string array (useful for Zod enums) */
export const DOMAIN_IDS = DOMAINS.map((d) => d.id) as [DomainId, ...DomainId[]];

/** Default domain used when no domain is specified */
export const DEFAULT_DOMAIN_ID: DomainId = "biomedical";
