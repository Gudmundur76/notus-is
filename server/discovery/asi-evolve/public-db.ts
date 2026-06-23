/**
 * Public Database Fetchers for ASI-Evolve Cognition Seeding
 * Sources: PubMed (NCBI E-utilities), RCSB PDB, ChEMBL, BindingDB, UniProt
 * All APIs are free, publicly accessible, and require no authentication except PubMed (optional key).
 */

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PDB_BASE = "https://data.rcsb.org/rest/v1";
const CHEMBL_BASE = "https://www.ebi.ac.uk/chembl/api/data";
const UNIPROT_BASE = "https://rest.uniprot.org/uniprotkb";

const FETCH_TIMEOUT = 15_000; // 15s per request

async function fetchWithTimeout(url: string, opts?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── PubMed ───────────────────────────────────────────────────────────────────

export interface PubMedRecord {
  pmid: string;
  title: string;
  abstract: string;
  year: number;
  journal: string;
}

/**
 * Search PubMed for HIV protease inhibitor literature.
 * Returns up to maxResults abstracts as cognition-ready strings.
 */
export async function fetchPubMedRecords(
  query: string = "HIV protease inhibitor pIC50 binding affinity",
  maxResults: number = 10
): Promise<PubMedRecord[]> {
  try {
    // Step 1: esearch to get PMIDs
    const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json&sort=relevance`;
    const searchRes = await fetchWithTimeout(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json() as any;
    const pmids: string[] = searchData?.esearchresult?.idlist || [];
    if (pmids.length === 0) return [];

    // Step 2: efetch to get abstracts
    const fetchUrl = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=xml&rettype=abstract`;
    const fetchRes = await fetchWithTimeout(fetchUrl);
    if (!fetchRes.ok) return [];
    const xml = await fetchRes.text();

    // Parse XML manually (no external XML parser needed)
    const records: PubMedRecord[] = [];
    const articleMatches = Array.from(xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g));
    for (const match of articleMatches) {
      const article = match[1];
      const pmid = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
      const title = article.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const abstract = article.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const year = parseInt(article.match(/<Year>(\d{4})<\/Year>/)?.[1] || "0");
      const journal = article.match(/<Title>([\s\S]*?)<\/Title>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      if (pmid && (title || abstract)) {
        records.push({ pmid, title, abstract, year, journal });
      }
    }
    return records;
  } catch {
    return [];
  }
}

// ─── RCSB PDB ────────────────────────────────────────────────────────────────

export interface PDBRecord {
  pdb_id: string;
  title: string;
  resolution?: number;
  ligand_id?: string;
  ligand_name?: string;
  binding_affinity?: string;
}

/**
 * Fetch HIV protease co-crystal structures from RCSB PDB.
 */
export async function fetchPDBRecords(maxResults: number = 10): Promise<PDBRecord[]> {
  try {
    // Search for HIV protease structures with bound inhibitors
    const searchBody = {
      query: {
        type: "group",
        logical_operator: "and",
        nodes: [
          {
            type: "terminal",
            service: "full_text",
            parameters: { value: "HIV protease inhibitor" }
          },
          {
            type: "terminal",
            service: "text",
            parameters: {
              attribute: "rcsb_entry_info.resolution_combined",
              operator: "less",
              value: 2.5
            }
          }
        ]
      },
      return_type: "entry",
      request_options: {
        paginate: { start: 0, rows: maxResults },
        sort: [{ sort_by: "score", direction: "desc" }]
      }
    };

    const searchRes = await fetchWithTimeout(`https://search.rcsb.org/rcsbsearch/v2/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody)
    });

    if (!searchRes.ok) return [];
    const searchData = await searchRes.json() as any;
    const entries: string[] = (searchData?.result_set || []).map((r: any) => r.identifier);

    const records: PDBRecord[] = [];
    for (const pdbId of entries.slice(0, maxResults)) {
      try {
        const entryRes = await fetchWithTimeout(`${PDB_BASE}/core/entry/${pdbId}`);
        if (!entryRes.ok) continue;
        const entry = await entryRes.json() as any;
        records.push({
          pdb_id: pdbId,
          title: entry?.struct?.title || "",
          resolution: entry?.rcsb_entry_info?.resolution_combined,
        });
      } catch { /* skip */ }
    }
    return records;
  } catch {
    return [];
  }
}

// ─── ChEMBL ───────────────────────────────────────────────────────────────────

export interface ChEMBLRecord {
  chembl_id: string;
  smiles: string;
  pchembl_value: number;
  assay_type: string;
  target_name: string;
  year?: number;
}

/**
 * Fetch HIV protease bioassay records from ChEMBL.
 * Returns compounds with pChEMBL values (= -log10(IC50/Ki/Kd in M)).
 */
export async function fetchChEMBLRecords(maxResults: number = 20): Promise<ChEMBLRecord[]> {
  try {
    // Target ChEMBL ID for HIV-1 protease: CHEMBL2093872
    const url = `${CHEMBL_BASE}/activity.json?target_chembl_id=CHEMBL2093872&pchembl_value__gte=6&limit=${maxResults}&format=json`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json() as any;
    const activities = data?.activities || [];

    return activities
      .filter((a: any) => a.canonical_smiles && a.pchembl_value)
      .map((a: any) => ({
        chembl_id: a.molecule_chembl_id || "",
        smiles: a.canonical_smiles || "",
        pchembl_value: parseFloat(a.pchembl_value) || 0,
        assay_type: a.assay_type || "",
        target_name: "HIV-1 protease",
        year: a.document_year ? parseInt(a.document_year) : undefined,
      }));
  } catch {
    return [];
  }
}

// ─── UniProt ─────────────────────────────────────────────────────────────────

export interface UniProtRecord {
  accession: string;
  name: string;
  sequence: string;
  active_sites: string[];
  binding_sites: string[];
}

/**
 * Fetch HIV-1 protease protein data from UniProt.
 * P04585 = HIV-1 protease (canonical).
 */
export async function fetchUniProtRecord(): Promise<UniProtRecord | null> {
  try {
    const res = await fetchWithTimeout(
      `${UNIPROT_BASE}/P04585.json`
    );
    if (!res.ok) return null;
    const data = await res.json() as any;

    const activeSites: string[] = [];
    const bindingSites: string[] = [];

    for (const feature of (data?.features || [])) {
      if (feature.type === "Active site") {
        activeSites.push(`${feature.description} at position ${feature.location?.start?.value}`);
      }
      if (feature.type === "Binding site") {
        bindingSites.push(`${feature.description} at position ${feature.location?.start?.value}`);
      }
    }

    return {
      accession: "P04585",
      name: data?.proteinDescription?.recommendedName?.fullName?.value || "HIV-1 protease",
      sequence: data?.sequence?.value || "",
      active_sites: activeSites,
      binding_sites: bindingSites,
    };
  } catch {
    return null;
  }
}

// ─── Cognition Item Builders ──────────────────────────────────────────────────

/** Convert PubMed records to cognition-ready content strings */
export function pubmedToCognitionContent(record: PubMedRecord): string {
  return `[PubMed:${record.pmid}] ${record.title} (${record.year}, ${record.journal}). ${record.abstract}`.slice(0, 1000);
}

/** Convert ChEMBL records to cognition-ready content strings */
export function chemblToCognitionContent(record: ChEMBLRecord): string {
  return `[ChEMBL:${record.chembl_id}] SMILES: ${record.smiles.slice(0, 100)} | pIC50=${record.pchembl_value.toFixed(2)} | Assay: ${record.assay_type} | Target: ${record.target_name}${record.year ? ` (${record.year})` : ""}`;
}

/** Convert PDB records to cognition-ready content strings */
export function pdbToCognitionContent(record: PDBRecord): string {
  return `[PDB:${record.pdb_id}] ${record.title}${record.resolution ? ` | Resolution: ${record.resolution}Å` : ""}${record.ligand_name ? ` | Ligand: ${record.ligand_name}` : ""}`;
}

/** Convert UniProt record to cognition-ready content strings */
export function uniprotToCognitionContent(record: UniProtRecord): string {
  const parts = [
    `[UniProt:${record.accession}] ${record.name}`,
    record.active_sites.length > 0 ? `Active sites: ${record.active_sites.slice(0, 3).join("; ")}` : "",
    record.binding_sites.length > 0 ? `Binding sites: ${record.binding_sites.slice(0, 3).join("; ")}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}
