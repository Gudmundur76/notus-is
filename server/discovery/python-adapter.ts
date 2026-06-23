/**
 * python-adapter.ts — Unified 65-Source Registry
 *
 * Maintains a static catalogue of every data source available to the
 * notus.is discovery engine: 15 TypeScript-native sources and 50
 * Python-only sources (served via python-bridge.ts).
 *
 * Usage:
 *   import { getAllSources, getPythonOnlySources, getSourcesByDomain } from "./python-adapter";
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SourceRegistry {
  id: string;
  name: string;
  domain: string;
  description: string;
  sourceUrl: string;
  isQuantumEligible: boolean;
  isNative: boolean;
  adapterType: "typescript" | "python";
}

// ── Native TypeScript sources (15) ────────────────────────────────────────────

const NATIVE_SOURCES: SourceRegistry[] = [
  {
    id: "pubchem",
    name: "PubChem",
    domain: "molecular",
    description: "115M+ compounds with SMILES, bioassay activity data (AID 1851 HIV protease)",
    sourceUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
    isQuantumEligible: true,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "chembl",
    name: "ChEMBL",
    domain: "molecular",
    description: "IC50/Ki/Kd for HIV protease CHEMBL247 + CHEMBL2093872",
    sourceUrl: "https://www.ebi.ac.uk/chembl/api/data",
    isQuantumEligible: true,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "pdb",
    name: "RCSB PDB",
    domain: "structural_biology",
    description: "Co-crystal structures and binding pocket residues for HIV protease",
    sourceUrl: "https://data.rcsb.org/rest/v1",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "uniprot",
    name: "UniProt",
    domain: "structural_biology",
    description: "HIV-1 protease sequence and active site annotations (P04585)",
    sourceUrl: "https://rest.uniprot.org",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "alphafold",
    name: "AlphaFold DB",
    domain: "structural_biology",
    description: "Predicted structures for HIV-1 protease (P04585)",
    sourceUrl: "https://alphafold.ebi.ac.uk/api",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "europe_pmc",
    name: "Europe PMC",
    domain: "literature",
    description: "40M+ open-access life sciences articles",
    sourceUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "openalex",
    name: "OpenAlex",
    domain: "literature",
    description: "250M+ works with citation graph",
    sourceUrl: "https://api.openalex.org",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "semanticscholar",
    name: "Semantic Scholar",
    domain: "literature",
    description: "200M+ papers with semantic search",
    sourceUrl: "https://api.semanticscholar.org/graph/v1",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "clinicaltrials",
    name: "ClinicalTrials.gov",
    domain: "clinical",
    description: "450K+ studies including HIV protease inhibitor trials",
    sourceUrl: "https://clinicaltrials.gov/api/v2",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "crossref",
    name: "CrossRef",
    domain: "literature",
    description: "DOI citation registry with retraction detection",
    sourceUrl: "https://api.crossref.org",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "citation_manus",
    name: "citation.manus.space",
    domain: "verification",
    description: "ttruthdesk verification layer — claim-level truth verdicts for structural biology",
    sourceUrl: "https://citation.manus.space/api/public",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "bindingdb",
    name: "BindingDB",
    domain: "molecular",
    description: "Curated HIV protease binding affinity measurements",
    sourceUrl: "https://www.bindingdb.org/axis2/services/BDBService",
    isQuantumEligible: true,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "wukong_vqe",
    name: "Wukong VQE",
    domain: "quantum",
    description: "Origin Quantum Cloud — real VQE circuits on full_amplitude / WK_C180_2 hardware",
    sourceUrl: "https://qcloud.originqc.com.cn",
    isQuantumEligible: true,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "pubmed",
    name: "PubMed",
    domain: "literature",
    description: "35M+ biomedical citations via NCBI E-utilities",
    sourceUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
  {
    id: "drugbank",
    name: "DrugBank",
    domain: "molecular",
    description: "Approved HIV protease inhibitor drug profiles and targets",
    sourceUrl: "https://go.drugbank.com/releases/latest/downloads",
    isQuantumEligible: false,
    isNative: true,
    adapterType: "typescript",
  },
];

// ── Python-only sources (50) ──────────────────────────────────────────────────

const PYTHON_SOURCES: SourceRegistry[] = [
  // Clinical / Evidence-based medicine
  {
    id: "cochrane",
    name: "Cochrane Library",
    domain: "clinical",
    description: "Systematic reviews and meta-analyses for HIV treatment",
    sourceUrl: "https://www.cochranelibrary.com",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "biorxiv",
    name: "bioRxiv",
    domain: "literature",
    description: "Preprint server for biology — early HIV protease research",
    sourceUrl: "https://api.biorxiv.org",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "embase",
    name: "Embase",
    domain: "literature",
    description: "Biomedical and pharmacological literature database",
    sourceUrl: "https://www.embase.com",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "ssrn",
    name: "SSRN",
    domain: "literature",
    description: "Social Science Research Network preprints",
    sourceUrl: "https://www.ssrn.com",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "campbell",
    name: "Campbell Collaboration",
    domain: "clinical",
    description: "Systematic reviews in social and behavioral sciences",
    sourceUrl: "https://www.campbellcollaboration.org",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "apa_psycarticles",
    name: "APA PsycArticles",
    domain: "clinical",
    description: "APA peer-reviewed psychology and behavioral health articles",
    sourceUrl: "https://www.apa.org/pubs/databases/psycarticles",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "who_iris",
    name: "WHO IRIS",
    domain: "clinical",
    description: "WHO Institutional Repository for Information Sharing",
    sourceUrl: "https://iris.who.int",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "nice",
    name: "NICE Guidelines",
    domain: "clinical",
    description: "UK National Institute for Health and Care Excellence guidelines",
    sourceUrl: "https://www.nice.org.uk/guidance",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Genomics / Variants
  {
    id: "clinvar",
    name: "ClinVar",
    domain: "genomics",
    description: "Clinically significant genomic variants — HIV drug resistance mutations",
    sourceUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Regulatory / Drug safety
  {
    id: "openfda_labels",
    name: "OpenFDA Drug Labels",
    domain: "regulatory",
    description: "FDA drug label data for approved HIV protease inhibitors",
    sourceUrl: "https://api.fda.gov/drug/label.json",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "openfda_adverse",
    name: "OpenFDA Adverse Events",
    domain: "regulatory",
    description: "FDA FAERS adverse event reports for HIV protease inhibitors",
    sourceUrl: "https://api.fda.gov/drug/event.json",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "who",
    name: "WHO Essential Medicines",
    domain: "regulatory",
    description: "WHO essential medicines list — HIV antiretrovirals",
    sourceUrl: "https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Nutrition / Supplements (domain expansion)
  {
    id: "proteinsupplement",
    name: "Protein Supplement DB",
    domain: "nutrition",
    description: "Protein supplement bioavailability and interaction data",
    sourceUrl: "https://ods.od.nih.gov/factsheets",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "creatineergogenics",
    name: "Creatine Ergogenics",
    domain: "nutrition",
    description: "Creatine supplementation RCT data and ergogenic effects",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "gutmicrobiome",
    name: "Gut Microbiome DB",
    domain: "nutrition",
    description: "Gut microbiome composition and drug metabolism interactions",
    sourceUrl: "https://www.ebi.ac.uk/metagenomics",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "collagenpeptides",
    name: "Collagen Peptides Research",
    domain: "nutrition",
    description: "Collagen peptide bioavailability and protease interaction studies",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "plantbasedprotein",
    name: "Plant-Based Protein DB",
    domain: "nutrition",
    description: "Plant protein digestibility and amino acid scoring",
    sourceUrl: "https://www.fao.org/food/food-safety-quality",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "sportsnutritionrct",
    name: "Sports Nutrition RCTs",
    domain: "nutrition",
    description: "Randomised controlled trials in sports nutrition",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "salmonbiotech",
    name: "Salmon Biotech DB",
    domain: "nutrition",
    description: "Salmon-derived bioactive peptides and protease inhibitor studies",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // HIV-specific
  {
    id: "hivprotease",
    name: "HIV Protease DB",
    domain: "molecular",
    description: "Curated HIV protease inhibitor activity database",
    sourceUrl: "https://hivdb.stanford.edu",
    isQuantumEligible: true,
    isNative: false,
    adapterType: "python",
  },
  // Food / Agriculture
  {
    id: "usda_fooddata",
    name: "USDA FoodData Central",
    domain: "nutrition",
    description: "USDA nutrient composition database",
    sourceUrl: "https://api.nal.usda.gov/fdc/v1",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Knowledge graphs
  {
    id: "wikidata",
    name: "Wikidata",
    domain: "knowledge_graph",
    description: "Structured knowledge graph — drug, disease, protein entities",
    sourceUrl: "https://query.wikidata.org/sparql",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "nist",
    name: "NIST Chemistry WebBook",
    domain: "molecular",
    description: "NIST thermochemical and spectral data for small molecules",
    sourceUrl: "https://webbook.nist.gov/chemistry",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Standards / Policy
  {
    id: "ietf_rfc",
    name: "IETF RFC",
    domain: "standards",
    description: "Internet Engineering Task Force standards documents",
    sourceUrl: "https://www.rfc-editor.org/rfc",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "codex",
    name: "Codex Alimentarius",
    domain: "regulatory",
    description: "FAO/WHO food safety standards and guidelines",
    sourceUrl: "https://www.fao.org/fao-who-codexalimentarius",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Climate / Environment
  {
    id: "ipcc",
    name: "IPCC Reports",
    domain: "climate",
    description: "Intergovernmental Panel on Climate Change assessment reports",
    sourceUrl: "https://www.ipcc.ch/reports",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "noaa",
    name: "NOAA Climate Data",
    domain: "climate",
    description: "NOAA National Centers for Environmental Information climate datasets",
    sourceUrl: "https://www.ncei.noaa.gov/access/services/data/v1",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "nasa_earthdata",
    name: "NASA EarthData",
    domain: "climate",
    description: "NASA Earth observation datasets",
    sourceUrl: "https://earthdata.nasa.gov",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "eea",
    name: "European Environment Agency",
    domain: "climate",
    description: "EEA environmental data and indicators",
    sourceUrl: "https://www.eea.europa.eu/data-and-maps",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "epa",
    name: "US EPA",
    domain: "climate",
    description: "US Environmental Protection Agency environmental data",
    sourceUrl: "https://www.epa.gov/data",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "usgs",
    name: "USGS",
    domain: "climate",
    description: "US Geological Survey earth science data",
    sourceUrl: "https://www.usgs.gov/products/data",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "owid",
    name: "Our World in Data",
    domain: "economics",
    description: "Global development indicators and health metrics",
    sourceUrl: "https://ourworldindata.org",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Energy
  {
    id: "iea",
    name: "IEA",
    domain: "energy",
    description: "International Energy Agency energy statistics",
    sourceUrl: "https://api.iea.org",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "irena",
    name: "IRENA",
    domain: "energy",
    description: "International Renewable Energy Agency statistics",
    sourceUrl: "https://www.irena.org/Data",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Economics / Finance
  {
    id: "worldbank",
    name: "World Bank",
    domain: "economics",
    description: "World Bank development indicators and health expenditure data",
    sourceUrl: "https://api.worldbank.org/v2",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "oecd",
    name: "OECD",
    domain: "economics",
    description: "OECD health and pharmaceutical statistics",
    sourceUrl: "https://stats.oecd.org/SDMX-JSON/data",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "eurostat",
    name: "Eurostat",
    domain: "economics",
    description: "EU statistical office — health and pharmaceutical data",
    sourceUrl: "https://ec.europa.eu/eurostat/api/dissemination",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "imf",
    name: "IMF",
    domain: "economics",
    description: "International Monetary Fund economic and health data",
    sourceUrl: "https://dataservices.imf.org/REST/SDMX_JSON.svc",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "fred",
    name: "FRED",
    domain: "economics",
    description: "Federal Reserve Economic Data — pharmaceutical market indicators",
    sourceUrl: "https://api.stlouisfed.org/fred",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "bis",
    name: "BIS",
    domain: "economics",
    description: "Bank for International Settlements financial stability data",
    sourceUrl: "https://stats.bis.org/api/v1",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Legal / Regulatory
  {
    id: "edgar_sec",
    name: "SEC EDGAR",
    domain: "legal",
    description: "SEC filings for pharmaceutical companies developing HIV treatments",
    sourceUrl: "https://efts.sec.gov/LATEST/search-index",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "eur_lex",
    name: "EUR-Lex",
    domain: "legal",
    description: "EU law and pharmaceutical regulation documents",
    sourceUrl: "https://eur-lex.europa.eu/search.html",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "courtlistener",
    name: "CourtListener",
    domain: "legal",
    description: "US court opinions — pharmaceutical patent litigation",
    sourceUrl: "https://www.courtlistener.com/api/rest/v3",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "us_code",
    name: "US Code",
    domain: "legal",
    description: "US federal law — drug approval and patent statutes",
    sourceUrl: "https://uscode.house.gov",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Generic / Cross-domain
  {
    id: "genericsource",
    name: "Generic Source",
    domain: "general",
    description: "Fallback adapter for unclassified sources",
    sourceUrl: "",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Citation / Retraction
  {
    id: "opencitations",
    name: "OpenCitations",
    domain: "literature",
    description: "Open citation graph — citation network for HIV protease papers",
    sourceUrl: "https://opencitations.net/api/v1",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "crossrefretraction",
    name: "CrossRef Retraction Watch",
    domain: "literature",
    description: "Retracted paper detection via CrossRef and Retraction Watch",
    sourceUrl: "https://api.crossref.org/works",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Preprints
  {
    id: "arxiv",
    name: "arXiv",
    domain: "literature",
    description: "arXiv preprints — quantum chemistry and drug discovery",
    sourceUrl: "https://export.arxiv.org/api/query",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
  // Specialised molecular / structural
  {
    id: "moleculardiscovery",
    name: "Molecular Discovery",
    domain: "molecular",
    description: "Molecular Discovery Ltd — ADMET and docking data",
    sourceUrl: "https://www.moldiscovery.com",
    isQuantumEligible: true,
    isNative: false,
    adapterType: "python",
  },
  {
    id: "structuralbiology",
    name: "Structural Biology DB",
    domain: "structural_biology",
    description: "Curated structural biology data for HIV protease inhibitor design",
    sourceUrl: "https://www.rcsb.org",
    isQuantumEligible: false,
    isNative: false,
    adapterType: "python",
  },
];

// ── Combined registry ─────────────────────────────────────────────────────────

const ALL_SOURCES: SourceRegistry[] = [...NATIVE_SOURCES, ...PYTHON_SOURCES];

// ── Exported query functions ──────────────────────────────────────────────────

/**
 * Returns all 65 sources (15 TypeScript-native + 50 Python-only).
 */
export function getAllSources(): SourceRegistry[] {
  return ALL_SOURCES;
}

/**
 * Returns only the 50 Python-only sources.
 */
export function getPythonOnlySources(): SourceRegistry[] {
  return ALL_SOURCES.filter(s => s.adapterType === "python");
}

/**
 * Returns sources filtered by domain (case-insensitive).
 */
export function getSourcesByDomain(domain: string): SourceRegistry[] {
  const lower = domain.toLowerCase();
  return ALL_SOURCES.filter(s => s.domain.toLowerCase() === lower);
}

/**
 * Returns sources that are eligible for quantum scoring.
 */
export function getQuantumEligibleSources(): SourceRegistry[] {
  return ALL_SOURCES.filter(s => s.isQuantumEligible);
}
