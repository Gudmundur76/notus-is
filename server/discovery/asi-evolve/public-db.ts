/**
 * Public Database Adapters — all 10 ttruthdesk molecular/literature sources
 *
 * Sources (matching ttruthdesk adapter names from pasted_content.txt):
 *   pubchem              — PubChem NIH (115M+ compounds, SMILES, bioassay)
 *   chembl               — ChEMBL EMBL-EBI (IC50/Ki/Kd binding data)
 *   structuralBiology    — RCSB PDB (experimental structures)
 *   uniprotVertical      — UniProt (protein sequence, active site)
 *   alphafold            — AlphaFold DB (predicted structures)
 *   europe_pmc           — Europe PMC (40M+ open-access life sciences)
 *   openAlex             — OpenAlex (250M+ works, citation graph)
 *   semanticScholar      — Semantic Scholar (200M+ papers)
 *   clinicalTrialsVertical — ClinicalTrials.gov (450K+ studies)
 *   crossRef             — Crossref DOI registry (130M+ DOIs)
 *
 * Note: ttruthdesk is the verification layer (separate software).
 * This module provides the discovery data sources for the ASI-Evolve engine.
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

const FETCH_TIMEOUT_MS = 15_000;

async function fetchJSON(url: string, opts: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "notus-is/1.0 (mailto:notus@hivprotease.is)" },
      ...opts,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, opts: RequestInit = {}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ─── 1. PubChem (NIH) — pubchem adapter ──────────────────────────────────────

export interface PubChemCompound {
  cid: number;
  smiles: string;
  iupac_name: string;
  molecular_weight: number;
  molecular_formula: string;
  xlogp: number;
  hbd: number;
  hba: number;
  tpsa: number;
  rotatable_bonds: number;
  inchikey: string;
  bioassay_activity?: string;
  pic50?: number;
}

/** Search PubChem for HIV protease inhibitor compounds by name. */
export async function fetchPubChemHIVCompounds(limit: number = 50): Promise<PubChemCompound[]> {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/HIV%20protease%20inhibitor/property/CanonicalSMILES,IUPACName,MolecularWeight,MolecularFormula,XLogP,HBondDonorCount,HBondAcceptorCount,TPSA,RotatableBondCount,InChIKey/JSON?MaxRecords=${limit}`;
    const data = await fetchJSON(url);
    const props = data?.PropertyTable?.Properties || [];
    return props.slice(0, limit).map((p: any) => ({
      cid: p.CID || 0,
      smiles: p.CanonicalSMILES || "",
      iupac_name: p.IUPACName || "",
      molecular_weight: Number(p.MolecularWeight) || 0,
      molecular_formula: p.MolecularFormula || "",
      xlogp: Number(p.XLogP) || 0,
      hbd: Number(p.HBondDonorCount) || 0,
      hba: Number(p.HBondAcceptorCount) || 0,
      tpsa: Number(p.TPSA) || 0,
      rotatable_bonds: Number(p.RotatableBondCount) || 0,
      inchikey: p.InChIKey || "",
    })).filter((c: PubChemCompound) => c.smiles.length > 5);
  } catch (e) {
    console.warn("[public-db:pubchem] fetch failed:", (e as Error).message);
    return [];
  }
}

/** Fetch active compounds from PubChem HIV-1 protease bioassay (AID 1851). */
export async function fetchPubChemBioassay(limit: number = 100): Promise<PubChemCompound[]> {
  try {
    // AID 1851 = HIV-1 protease inhibition assay
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/assay/aid/1851/cids/JSON?cids_type=active&list_return=listkey`;
    const listData = await fetchJSON(url);
    const listKey = listData?.IdentifierList?.ListKey;
    if (!listKey) return [];

    const propsUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/listkey/${listKey}/property/CanonicalSMILES,MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount,TPSA,RotatableBondCount/JSON`;
    const propData = await fetchJSON(propsUrl);
    const props = propData?.PropertyTable?.Properties || [];

    return props.slice(0, limit).map((p: any) => ({
      cid: p.CID || 0,
      smiles: p.CanonicalSMILES || "",
      iupac_name: "",
      molecular_weight: Number(p.MolecularWeight) || 0,
      molecular_formula: "",
      xlogp: Number(p.XLogP) || 0,
      hbd: Number(p.HBondDonorCount) || 0,
      hba: Number(p.HBondAcceptorCount) || 0,
      tpsa: Number(p.TPSA) || 0,
      rotatable_bonds: Number(p.RotatableBondCount) || 0,
      inchikey: "",
      bioassay_activity: "Active",
    })).filter((c: PubChemCompound) => c.smiles.length > 5);
  } catch (e) {
    console.warn("[public-db:pubchem-bioassay] fetch failed:", (e as Error).message);
    return [];
  }
}

// ─── 2. ChEMBL (EMBL-EBI) — chembl adapter ───────────────────────────────────

export interface ChEMBLRecord {
  chembl_id: string;
  smiles: string;
  pchembl_value: number;
  standard_type: string;
  standard_value: number;
  standard_units: string;
  assay_type: string;
  target_name: string;
  year?: number;
}

/** Fetch HIV-1 protease bioassay records from ChEMBL (CHEMBL247 + CHEMBL2093872). */
export async function fetchChEMBLRecords(maxResults: number = 200): Promise<ChEMBLRecord[]> {
  try {
    // CHEMBL247 = HIV-1 protease (primary target)
    const url = `https://www.ebi.ac.uk/chembl/api/data/activity.json?target_chembl_id=CHEMBL247&standard_type__in=IC50,Ki,Kd&pchembl_value__isnull=false&limit=${maxResults}&offset=0`;
    const data = await fetchJSON(url);
    const activities = data?.activities || [];

    return activities
      .filter((a: any) => a.canonical_smiles && a.pchembl_value)
      .map((a: any) => ({
        chembl_id: a.molecule_chembl_id || "",
        smiles: a.canonical_smiles || "",
        pchembl_value: parseFloat(a.pchembl_value) || 0,
        standard_type: a.standard_type || "IC50",
        standard_value: Number(a.standard_value) || 0,
        standard_units: a.standard_units || "nM",
        assay_type: a.assay_type || "",
        target_name: "HIV-1 protease",
        year: a.document_year ? parseInt(a.document_year) : undefined,
      }));
  } catch (e) {
    console.warn("[public-db:chembl] fetch failed:", (e as Error).message);
    return [];
  }
}

// ─── 3. RCSB PDB — structuralBiology adapter ─────────────────────────────────

export interface PDBRecord {
  pdb_id: string;
  title: string;
  resolution?: number;
  ligand_id?: string;
  ligand_name?: string;
  ligand_smiles?: string;
  binding_affinity?: string;
  year?: number;
}

/** Fetch HIV protease co-crystal structures from RCSB PDB. */
export async function fetchPDBRecords(maxResults: number = 20): Promise<PDBRecord[]> {
  try {
    const searchBody = {
      query: {
        type: "group",
        logical_operator: "and",
        nodes: [
          { type: "terminal", service: "full_text", parameters: { value: "HIV protease inhibitor" } },
          { type: "terminal", service: "text", parameters: { attribute: "rcsb_entry_info.resolution_combined", operator: "less", value: 2.5 } },
        ],
      },
      return_type: "entry",
      request_options: { paginate: { start: 0, rows: maxResults }, sort: [{ sort_by: "score", direction: "desc" }] },
    };

    const searchRes = await fetch("https://search.rcsb.org/rcsbsearch/v2/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!searchRes.ok) return [];
    const searchData = await searchRes.json() as any;
    const entries: string[] = (searchData?.result_set || []).map((r: any) => r.identifier);

    const records: PDBRecord[] = [];
    for (const pdbId of entries.slice(0, maxResults)) {
      try {
        const entry = await fetchJSON(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`);
        records.push({
          pdb_id: pdbId,
          title: entry?.struct?.title || "",
          resolution: entry?.rcsb_entry_info?.resolution_combined,
          year: entry?.rcsb_accession_info?.initial_release_date
            ? new Date(entry.rcsb_accession_info.initial_release_date).getFullYear()
            : undefined,
        });
      } catch { /* skip */ }
    }
    return records;
  } catch (e) {
    console.warn("[public-db:pdb] fetch failed:", (e as Error).message);
    return [];
  }
}

// ─── 4. UniProt — uniprotVertical adapter ────────────────────────────────────

export interface UniProtRecord {
  accession: string;
  name: string;
  sequence: string;
  active_sites: string[];
  binding_sites: string[];
  keywords: string[];
  go_terms: string[];
}

/** Fetch HIV-1 protease protein data from UniProt (P04585). */
export async function fetchUniProtRecord(): Promise<UniProtRecord | null> {
  try {
    const data = await fetchJSON("https://rest.uniprot.org/uniprotkb/P04585.json");
    const activeSites: string[] = [];
    const bindingSites: string[] = [];

    for (const feature of (data?.features || [])) {
      if (feature.type === "Active site") {
        activeSites.push(`${feature.description || ""} at position ${feature.location?.start?.value}`);
      }
      if (feature.type === "Binding site") {
        bindingSites.push(`${feature.description || ""} at position ${feature.location?.start?.value}`);
      }
    }

    const keywords = (data?.keywords || []).map((k: any) => k.name || "").filter(Boolean);
    const goTerms = (data?.uniProtKBCrossReferences || [])
      .filter((ref: any) => ref.database === "GO")
      .map((ref: any) => ref.properties?.find((p: any) => p.key === "GoTerm")?.value || "")
      .filter(Boolean)
      .slice(0, 10);

    return {
      accession: "P04585",
      name: data?.proteinDescription?.recommendedName?.fullName?.value || "HIV-1 protease",
      sequence: data?.sequence?.value || "",
      active_sites: activeSites,
      binding_sites: bindingSites,
      keywords,
      go_terms: goTerms,
    };
  } catch (e) {
    console.warn("[public-db:uniprot] fetch failed:", (e as Error).message);
    return null;
  }
}

// ─── 5. AlphaFold DB — alphafold adapter ─────────────────────────────────────

export interface AlphaFoldRecord {
  accession: string;
  gene: string;
  uniprotStart: number;
  uniprotEnd: number;
  pdbUrl: string;
  cifUrl: string;
  latestVersion: number;
  meanPlddt?: number;
}

/** Fetch AlphaFold predicted structure metadata for HIV-1 protease (P04585). */
export async function fetchAlphaFoldRecord(): Promise<AlphaFoldRecord | null> {
  try {
    const data = await fetchJSON("https://alphafold.ebi.ac.uk/api/prediction/P04585");
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry) return null;

    return {
      accession: entry.uniprotAccession || "P04585",
      gene: entry.gene || "pol",
      uniprotStart: entry.uniprotStart || 1,
      uniprotEnd: entry.uniprotEnd || 99,
      pdbUrl: entry.pdbUrl || "",
      cifUrl: entry.cifUrl || "",
      latestVersion: entry.latestVersion || 4,
      meanPlddt: entry.meanPlddt,
    };
  } catch (e) {
    console.warn("[public-db:alphafold] fetch failed:", (e as Error).message);
    return null;
  }
}

// ─── 6. Europe PMC — europe_pmc adapter ──────────────────────────────────────

export interface EuropePMCRecord {
  pmid: string;
  pmcid: string;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  year: number;
  doi: string;
  is_open_access: boolean;
  citation_count: number;
}

/** Search Europe PMC for HIV protease inhibitor literature (40M+ open-access). */
export async function fetchEuropePMCRecords(limit: number = 30): Promise<EuropePMCRecord[]> {
  try {
    const query = encodeURIComponent('("HIV-1 protease" OR "HIV protease") AND ("inhibitor") AND (ABSTRACT:"IC50" OR ABSTRACT:"Ki" OR ABSTRACT:"pIC50")');
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${query}&resultType=core&pageSize=${limit}&format=json&sort=CITED+desc`;
    const data = await fetchJSON(url);
    const results = data?.resultList?.result || [];

    return results.map((r: any) => ({
      pmid: r.pmid || "",
      pmcid: r.pmcid || "",
      title: r.title || "",
      abstract: r.abstractText || "",
      authors: (r.authorList?.author || []).map((a: any) => a.fullName || "").join(", "),
      journal: r.journalTitle || "",
      year: Number(r.pubYear) || 0,
      doi: r.doi || "",
      is_open_access: r.isOpenAccess === "Y",
      citation_count: Number(r.citedByCount) || 0,
    })).filter((a: EuropePMCRecord) => a.abstract.length > 50);
  } catch (e) {
    console.warn("[public-db:europe_pmc] fetch failed:", (e as Error).message);
    return [];
  }
}

// ─── 7. OpenAlex — openAlex adapter ──────────────────────────────────────────

export interface OpenAlexRecord {
  id: string;
  title: string;
  abstract: string;
  year: number;
  doi: string;
  cited_by_count: number;
  concepts: string[];
  open_access: boolean;
  authors: string;
}

/** Search OpenAlex for HIV protease inhibitor research (250M+ works). */
export async function fetchOpenAlexRecords(limit: number = 30): Promise<OpenAlexRecord[]> {
  try {
    const url = `https://api.openalex.org/works?search=HIV+protease+inhibitor+binding+affinity&filter=type:article,publication_year:2010-2025&sort=cited_by_count:desc&per-page=${limit}&mailto=notus@hivprotease.is`;
    const data = await fetchJSON(url);
    const results = data?.results || [];

    return results.map((w: any) => {
      // OpenAlex stores abstract as inverted index — reconstruct
      let abstract = "";
      if (w.abstract_inverted_index) {
        const words: Array<[string, number]> = [];
        for (const [word, positions] of Object.entries(w.abstract_inverted_index)) {
          for (const pos of positions as number[]) {
            words.push([word, pos]);
          }
        }
        words.sort((a, b) => a[1] - b[1]);
        abstract = words.map(([w]) => w).join(" ");
      }

      return {
        id: w.id || "",
        title: w.display_name || w.title || "",
        abstract,
        year: w.publication_year || 0,
        doi: w.doi || "",
        cited_by_count: w.cited_by_count || 0,
        concepts: (w.concepts || []).slice(0, 5).map((c: any) => c.display_name || ""),
        open_access: w.open_access?.is_oa || false,
        authors: (w.authorships || []).slice(0, 3).map((a: any) => a.author?.display_name || "").join(", "),
      };
    }).filter((w: OpenAlexRecord) => w.abstract.length > 50);
  } catch (e) {
    console.warn("[public-db:openAlex] fetch failed:", (e as Error).message);
    return [];
  }
}

// ─── 8. Semantic Scholar — semanticScholar adapter ───────────────────────────

export interface SemanticScholarRecord {
  paper_id: string;
  title: string;
  abstract: string;
  year: number;
  doi: string;
  citation_count: number;
  influential_citation_count: number;
  authors: string;
  fields_of_study: string[];
  tldr: string;
}

/** Search Semantic Scholar for HIV protease inhibitor papers (200M+ papers). */
export async function fetchSemanticScholarRecords(limit: number = 30): Promise<SemanticScholarRecord[]> {
  try {
    const query = encodeURIComponent("HIV-1 protease inhibitor binding affinity IC50");
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${query}&fields=paperId,title,abstract,year,externalIds,citationCount,influentialCitationCount,authors,fieldsOfStudy,tldr&limit=${limit}`;
    const data = await fetchJSON(url);
    const papers = data?.data || [];

    return papers.map((p: any) => ({
      paper_id: p.paperId || "",
      title: p.title || "",
      abstract: p.abstract || "",
      year: p.year || 0,
      doi: p.externalIds?.DOI || "",
      citation_count: p.citationCount || 0,
      influential_citation_count: p.influentialCitationCount || 0,
      authors: (p.authors || []).slice(0, 3).map((a: any) => a.name || "").join(", "),
      fields_of_study: p.fieldsOfStudy || [],
      tldr: p.tldr?.text || "",
    })).filter((p: SemanticScholarRecord) => p.abstract.length > 50);
  } catch (e) {
    console.warn("[public-db:semanticScholar] fetch failed:", (e as Error).message);
    return [];
  }
}

// ─── 9. ClinicalTrials.gov — clinicalTrialsVertical adapter ──────────────────

export interface ClinicalTrialRecord {
  nct_id: string;
  title: string;
  status: string;
  phase: string;
  condition: string;
  intervention: string;
  sponsor: string;
  start_date: string;
  brief_summary: string;
}

/** Fetch HIV protease inhibitor clinical trials from ClinicalTrials.gov (450K+ studies). */
export async function fetchClinicalTrialRecords(limit: number = 20): Promise<ClinicalTrialRecord[]> {
  try {
    const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=HIV&query.intr=protease+inhibitor&filter.overallStatus=COMPLETED,ACTIVE_NOT_RECRUITING&pageSize=${limit}&fields=NCTId,BriefTitle,OverallStatus,Phase,Condition,InterventionName,LeadSponsorName,StartDate,BriefSummary`;
    const data = await fetchJSON(url);
    const studies = data?.studies || [];

    return studies.map((s: any) => {
      const proto = s.protocolSection || {};
      const id = proto.identificationModule || {};
      const status = proto.statusModule || {};
      const design = proto.designModule || {};
      const conditions = proto.conditionsModule || {};
      const interventions = proto.armsInterventionsModule || {};
      const sponsor = proto.sponsorCollaboratorsModule || {};
      const desc = proto.descriptionModule || {};

      return {
        nct_id: id.nctId || "",
        title: id.briefTitle || "",
        status: status.overallStatus || "",
        phase: (design.phases || []).join(", "),
        condition: (conditions.conditions || []).join("; "),
        intervention: (interventions.interventions || []).map((i: any) => i.name || "").join("; "),
        sponsor: sponsor.leadSponsor?.name || "",
        start_date: status.startDateStruct?.date || "",
        brief_summary: desc.briefSummary || "",
      };
    }).filter((t: ClinicalTrialRecord) => t.nct_id.length > 0);
  } catch (e) {
    console.warn("[public-db:clinicalTrials] fetch failed:", (e as Error).message);
    return [];
  }
}

// ─── 10. CrossRef — crossRef adapter ─────────────────────────────────────────

export interface CrossRefRecord {
  doi: string;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  year: number;
  citation_count: number;
  is_retracted: boolean;
}

/** Search CrossRef for HIV protease inhibitor literature (130M+ DOIs). */
export async function fetchCrossRefRecords(limit: number = 30): Promise<CrossRefRecord[]> {
  try {
    const query = encodeURIComponent("HIV-1 protease inhibitor binding affinity");
    const url = `https://api.crossref.org/works?query=${query}&filter=type:journal-article,from-pub-date:2010&sort=is-referenced-by-count&order=desc&rows=${limit}&mailto=notus@hivprotease.is`;
    const data = await fetchJSON(url);
    const items = data?.message?.items || [];

    return items.map((item: any) => ({
      doi: item.DOI || "",
      title: (item.title || [])[0] || "",
      abstract: item.abstract || "",
      authors: (item.author || []).slice(0, 3)
        .map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
        .join(", "),
      journal: (item["container-title"] || [])[0] || "",
      year: item.published?.["date-parts"]?.[0]?.[0] || 0,
      citation_count: item["is-referenced-by-count"] || 0,
      is_retracted: (item.relation?.["is-retraction-of"] || []).length > 0,
    })).filter((w: CrossRefRecord) => !w.is_retracted && w.title.length > 5);
  } catch (e) {
    console.warn("[public-db:crossRef] fetch failed:", (e as Error).message);
    return [];
  }
}

// ─── Legacy PubMed (NCBI E-utilities) — kept for backward compat ──────────────

export interface PubMedRecord {
  pmid: string;
  title: string;
  abstract: string;
  year: number;
  journal: string;
}

export async function fetchPubMedRecords(
  query: string = "HIV protease inhibitor pIC50 binding affinity",
  maxResults: number = 10
): Promise<PubMedRecord[]> {
  try {
    const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json&sort=relevance`;
    const searchData = await fetchJSON(searchUrl);
    const pmids: string[] = searchData?.esearchresult?.idlist || [];
    if (pmids.length === 0) return [];

    const fetchUrl = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=xml&rettype=abstract`;
    const xml = await fetchText(fetchUrl);

    const records: PubMedRecord[] = [];
    const articleMatches = Array.from(xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g));
    for (const match of articleMatches) {
      const article = match[1];
      const pmid = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
      const title = article.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const abstract = article.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const year = parseInt(article.match(/<Year>(\d{4})<\/Year>/)?.[1] || "0");
      const journal = article.match(/<Title>([\s\S]*?)<\/Title>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      if (pmid && (title || abstract)) records.push({ pmid, title, abstract, year, journal });
    }
    return records;
  } catch {
    return [];
  }
}

// ─── Cognition Content Builders ───────────────────────────────────────────────
// Convert each source record into a cognition-store-ready string

export function pubchemToCognitionContent(c: PubChemCompound): string {
  return `[PubChem:${c.cid}] ${c.iupac_name || "compound"} MW=${c.molecular_weight.toFixed(1)}, LogP=${c.xlogp.toFixed(2)}, TPSA=${c.tpsa.toFixed(1)}, HBD=${c.hbd}, HBA=${c.hba}. SMILES: ${c.smiles}. Activity: ${c.bioassay_activity || "unknown"}.${c.pic50 ? ` pIC50=${c.pic50.toFixed(2)}.` : ""}`.slice(0, 1000);
}

export function chemblToCognitionContent(a: ChEMBLRecord): string {
  return `[ChEMBL:${a.chembl_id}] SMILES: ${a.smiles.slice(0, 100)} | pIC50=${a.pchembl_value.toFixed(2)} | ${a.standard_type}=${a.standard_value.toFixed(1)}${a.standard_units} | Target: HIV-1 protease${a.year ? ` (${a.year})` : ""}`.slice(0, 1000);
}

export function pdbToCognitionContent(r: PDBRecord): string {
  return `[PDB:${r.pdb_id}] ${r.title}${r.resolution ? ` | Resolution: ${r.resolution}Å` : ""}${r.ligand_name ? ` | Ligand: ${r.ligand_name}` : ""}${r.year ? ` | Year: ${r.year}` : ""}`.slice(0, 1000);
}

export function uniprotToCognitionContent(r: UniProtRecord): string {
  return `[UniProt:${r.accession}] ${r.name} | Active sites: ${r.active_sites.slice(0, 3).join("; ")} | Binding sites: ${r.binding_sites.slice(0, 3).join("; ")} | Keywords: ${r.keywords.slice(0, 5).join(", ")}`.slice(0, 1000);
}

export function alphaFoldToCognitionContent(r: AlphaFoldRecord): string {
  return `[AlphaFold:${r.accession}] Predicted structure for HIV-1 protease (gene: ${r.gene}), residues ${r.uniprotStart}-${r.uniprotEnd}, version ${r.latestVersion}.${r.meanPlddt ? ` Mean pLDDT: ${r.meanPlddt.toFixed(1)}.` : ""} PDB: ${r.pdbUrl}`.slice(0, 1000);
}

export function europePMCToCognitionContent(r: EuropePMCRecord): string {
  return `[EuropePMC:${r.pmid || r.pmcid}] ${r.title} (${r.year}, ${r.journal})${r.is_open_access ? " [OA]" : ""}. ${r.abstract.slice(0, 400)}. Citations: ${r.citation_count}.`.slice(0, 1000);
}

export function openAlexToCognitionContent(w: OpenAlexRecord): string {
  return `[OpenAlex:${w.id.split("/").pop()}] ${w.title} (${w.year}). ${w.abstract.slice(0, 400)}. Citations: ${w.cited_by_count}. Concepts: ${w.concepts.join(", ")}.`.slice(0, 1000);
}

export function semanticScholarToCognitionContent(p: SemanticScholarRecord): string {
  const tldr = p.tldr ? ` TL;DR: ${p.tldr}` : "";
  return `[S2:${p.paper_id.slice(0, 8)}] ${p.title} (${p.year}).${tldr} ${p.abstract.slice(0, 300)}. Influential citations: ${p.influential_citation_count}.`.slice(0, 1000);
}

export function clinicalTrialToCognitionContent(t: ClinicalTrialRecord): string {
  return `[ClinicalTrials:${t.nct_id}] ${t.title}. Status: ${t.status}. Phase: ${t.phase}. Intervention: ${t.intervention.slice(0, 100)}. ${t.brief_summary.slice(0, 200)}.`.slice(0, 1000);
}

export function crossRefToCognitionContent(w: CrossRefRecord): string {
  const abstract = w.abstract ? ` ${w.abstract.slice(0, 200)}.` : "";
  return `[CrossRef:${w.doi}] ${w.title} (${w.year}, ${w.journal}).${abstract} Citations: ${w.citation_count}.`.slice(0, 1000);
}

// ─── Legacy content builders (backward compat) ───────────────────────────────

export function pubmedToCognitionContent(record: PubMedRecord): string {
  return `[PubMed:${record.pmid}] ${record.title} (${record.year}, ${record.journal}). ${record.abstract}`.slice(0, 1000);
}
