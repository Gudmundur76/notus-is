/**
 * ASI-Evolve Cognition Seeder
 * Seeds the cognition store with verified knowledge from all 10 ttruthdesk sources.
 * Runs at the start of each evolution run and refreshes every N steps.
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 *
 * Sources (matching ttruthdesk adapter names):
 *   1. pubchem              — PubChem NIH (115M+ compounds, bioassay)
 *   2. chembl               — ChEMBL EMBL-EBI (IC50/Ki/Kd binding data)
 *   3. structuralBiology    — RCSB PDB (experimental structures)
 *   4. uniprotVertical      — UniProt (protein sequence, active site)
 *   5. alphafold            — AlphaFold DB (predicted structures)
 *   6. europe_pmc           — Europe PMC (40M+ open-access life sciences)
 *   7. openAlex             — OpenAlex (250M+ works, citation graph)
 *   8. semanticScholar      — Semantic Scholar (200M+ papers)
 *   9. clinicalTrialsVertical — ClinicalTrials.gov (450K+ studies)
 *  10. crossRef             — Crossref DOI registry (130M+ DOIs)
 */

import { addCognitionBatch, getCognitionCount } from "./cognition";
import {
  fetchHivProteaseVerifiedClaims,
  listClaimsByVertical,
} from "./citation-client";
import {
  // PubChem
  fetchPubChemHIVCompounds,
  fetchPubChemBioassay,
  pubchemToCognitionContent,
  // ChEMBL
  fetchChEMBLRecords,
  chemblToCognitionContent,
  // PDB
  fetchPDBRecords,
  pdbToCognitionContent,
  // UniProt
  fetchUniProtRecord,
  uniprotToCognitionContent,
  // AlphaFold
  fetchAlphaFoldRecord,
  alphaFoldToCognitionContent,
  // Europe PMC
  fetchEuropePMCRecords,
  europePMCToCognitionContent,
  // OpenAlex
  fetchOpenAlexRecords,
  openAlexToCognitionContent,
  // Semantic Scholar
  fetchSemanticScholarRecords,
  semanticScholarToCognitionContent,
  // ClinicalTrials
  fetchClinicalTrialRecords,
  clinicalTrialToCognitionContent,
  // CrossRef
  fetchCrossRefRecords,
  crossRefToCognitionContent,
  // Legacy PubMed
  fetchPubMedRecords,
  pubmedToCognitionContent,
} from "./public-db";
import type { CognitionItem } from "./types";

function makeItem(
  runId: number,
  content: string,
  source: string,
  source_type: CognitionItem["source_type"],
  metadata: Record<string, unknown> = {}
): Omit<CognitionItem, "id"> {
  return {
    run_id: runId,
    content: content.slice(0, 1000),
    source,
    source_type,
    embedding: [],
    created_at: Date.now(),
    metadata,
  };
}

/**
 * Seed the cognition store from all 10 public databases.
 * Idempotent: skips if already seeded (count > 0).
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

  console.log("[Cognition] Seeding from all 10 ttruthdesk sources...");
  const items: Omit<CognitionItem, "id">[] = [];
  const sources: Record<string, number> = {};

  // ── 1. PubChem ──────────────────────────────────────────────────────────────
  try {
    const [nameCompounds, bioassayCompounds] = await Promise.all([
      fetchPubChemHIVCompounds(30),
      fetchPubChemBioassay(50),
    ]);
    const allPubChem = [...nameCompounds, ...bioassayCompounds];
    for (const c of allPubChem) {
      if (!c.smiles) continue;
      items.push(makeItem(runId, pubchemToCognitionContent(c), `PubChem:${c.cid}`, "pubchem", {
        cid: c.cid, smiles: c.smiles, mw: c.molecular_weight,
      }));
    }
    sources.pubchem = allPubChem.length;
    console.log(`[Cognition] PubChem: +${allPubChem.length}`);
  } catch (e) { console.warn("[Cognition] PubChem failed:", (e as Error).message); }

  // ── 2. ChEMBL ───────────────────────────────────────────────────────────────
  try {
    const chemblRecords = await fetchChEMBLRecords(100);
    for (const a of chemblRecords) {
      if (a.pchembl_value >= 6.0) { // pIC50 >= 6 = IC50 <= 1µM
        items.push(makeItem(runId, chemblToCognitionContent(a), `ChEMBL:${a.chembl_id}`, "chembl", {
          chembl_id: a.chembl_id, smiles: a.smiles, pchembl_value: a.pchembl_value,
        }));
      }
    }
    sources.chembl = chemblRecords.length;
    console.log(`[Cognition] ChEMBL: +${chemblRecords.length}`);
  } catch (e) { console.warn("[Cognition] ChEMBL failed:", (e as Error).message); }

  // ── 3. RCSB PDB ─────────────────────────────────────────────────────────────
  try {
    const pdbRecords = await fetchPDBRecords(20);
    for (const r of pdbRecords) {
      items.push(makeItem(runId, pdbToCognitionContent(r), `PDB:${r.pdb_id}`, "pdb", {
        pdb_id: r.pdb_id, resolution: r.resolution,
      }));
    }
    sources.pdb = pdbRecords.length;
    console.log(`[Cognition] PDB: +${pdbRecords.length}`);
  } catch (e) { console.warn("[Cognition] PDB failed:", (e as Error).message); }

  // ── 4. UniProt ──────────────────────────────────────────────────────────────
  try {
    const uniprotRecord = await fetchUniProtRecord();
    if (uniprotRecord) {
      items.push(makeItem(runId, uniprotToCognitionContent(uniprotRecord), `UniProt:${uniprotRecord.accession}`, "uniprot", {
        accession: uniprotRecord.accession,
        active_sites: uniprotRecord.active_sites,
        binding_sites: uniprotRecord.binding_sites,
      }));
      // Sequence as separate item
      if (uniprotRecord.sequence) {
        const seqContent = `[UniProt:P04585-seq] HIV-1 protease sequence (${uniprotRecord.sequence.length} aa). Active site: Asp25-Thr26-Gly27. Flap: Ile47-Gly51. Sequence: ${uniprotRecord.sequence.slice(0, 200)}`;
        items.push(makeItem(runId, seqContent, "UniProt:P04585-sequence", "uniprot", { sequence_length: uniprotRecord.sequence.length }));
      }
      sources.uniprot = 2;
      console.log("[Cognition] UniProt: +2");
    }
  } catch (e) { console.warn("[Cognition] UniProt failed:", (e as Error).message); }

  // ── 5. AlphaFold ────────────────────────────────────────────────────────────
  try {
    const afRecord = await fetchAlphaFoldRecord();
    if (afRecord) {
      items.push(makeItem(runId, alphaFoldToCognitionContent(afRecord), `AlphaFold:${afRecord.accession}`, "alphafold", {
        accession: afRecord.accession, pdb_url: afRecord.pdbUrl, mean_plddt: afRecord.meanPlddt,
      }));
      sources.alphafold = 1;
      console.log("[Cognition] AlphaFold: +1");
    }
  } catch (e) { console.warn("[Cognition] AlphaFold failed:", (e as Error).message); }

  // ── 6. Europe PMC ───────────────────────────────────────────────────────────
  try {
    const epmc = await fetchEuropePMCRecords(20);
    for (const r of epmc) {
      items.push(makeItem(runId, europePMCToCognitionContent(r), `EuropePMC:${r.pmid || r.pmcid}`, "europe_pmc", {
        pmid: r.pmid, doi: r.doi, citation_count: r.citation_count, is_open_access: r.is_open_access,
      }));
    }
    sources.europe_pmc = epmc.length;
    console.log(`[Cognition] Europe PMC: +${epmc.length}`);
  } catch (e) { console.warn("[Cognition] Europe PMC failed:", (e as Error).message); }

  // ── 7. OpenAlex ─────────────────────────────────────────────────────────────
  try {
    const oaWorks = await fetchOpenAlexRecords(20);
    for (const w of oaWorks) {
      items.push(makeItem(runId, openAlexToCognitionContent(w), `OpenAlex:${w.id.split("/").pop()}`, "openAlex", {
        id: w.id, doi: w.doi, cited_by_count: w.cited_by_count,
      }));
    }
    sources.openAlex = oaWorks.length;
    console.log(`[Cognition] OpenAlex: +${oaWorks.length}`);
  } catch (e) { console.warn("[Cognition] OpenAlex failed:", (e as Error).message); }

  // ── 8. Semantic Scholar ─────────────────────────────────────────────────────
  try {
    const s2Papers = await fetchSemanticScholarRecords(20);
    for (const p of s2Papers) {
      items.push(makeItem(runId, semanticScholarToCognitionContent(p), `S2:${p.paper_id}`, "semanticScholar", {
        paper_id: p.paper_id, doi: p.doi, influential_citation_count: p.influential_citation_count,
      }));
    }
    sources.semanticScholar = s2Papers.length;
    console.log(`[Cognition] Semantic Scholar: +${s2Papers.length}`);
  } catch (e) { console.warn("[Cognition] Semantic Scholar failed:", (e as Error).message); }

  // ── 9. ClinicalTrials.gov ───────────────────────────────────────────────────
  try {
    const trials = await fetchClinicalTrialRecords(15);
    for (const t of trials) {
      items.push(makeItem(runId, clinicalTrialToCognitionContent(t), `ClinicalTrials:${t.nct_id}`, "clinicalTrials", {
        nct_id: t.nct_id, status: t.status, phase: t.phase,
      }));
    }
    sources.clinicalTrials = trials.length;
    console.log(`[Cognition] ClinicalTrials: +${trials.length}`);
  } catch (e) { console.warn("[Cognition] ClinicalTrials failed:", (e as Error).message); }

  // ── 10. CrossRef ────────────────────────────────────────────────────────────
  try {
    const crWorks = await fetchCrossRefRecords(20);
    for (const w of crWorks) {
      items.push(makeItem(runId, crossRefToCognitionContent(w), `CrossRef:${w.doi}`, "crossRef", {
        doi: w.doi, journal: w.journal, citation_count: w.citation_count,
      }));
    }
    sources.crossRef = crWorks.length;
    console.log(`[Cognition] CrossRef: +${crWorks.length}`);
  } catch (e) { console.warn("[Cognition] CrossRef failed:", (e as Error).message); }

  // ── Legacy PubMed (NCBI E-utilities) ────────────────────────────────────────
  try {
    const [general, structural, clinical] = await Promise.all([
      fetchPubMedRecords("HIV protease inhibitor pIC50 binding affinity", 10),
      fetchPubMedRecords("HIV protease crystal structure inhibitor binding site", 5),
      fetchPubMedRecords("HIV protease inhibitor clinical resistance mechanism", 5),
    ]);
    const allPubMed = [...general, ...structural, ...clinical];
    for (const r of allPubMed) {
      if (pubmedToCognitionContent(r).length > 50) {
        items.push(makeItem(runId, pubmedToCognitionContent(r), `PubMed:${r.pmid}`, "pubmed", {
          pmid: r.pmid, year: r.year, journal: r.journal,
        }));
      }
    }
    sources.pubmed = allPubMed.length;
    console.log(`[Cognition] PubMed: +${allPubMed.length}`);
  } catch (e) { console.warn("[Cognition] PubMed failed:", (e as Error).message); }

  // ── 11. citation.manus.space — external verified claims corpus ─────────────────────────────
  // Pull the most recent Supported claims for HIV protease from the ttruthdesk corpus.
  // These are peer-reviewed, database-verified claims that serve as ground truth.
  try {
    const hivClaims = await fetchHivProteaseVerifiedClaims(200);
    for (const claim of hivClaims) {
      const content =
        `[citation.manus.space Verified] ${claim.claim_text} ` +
        `(verdict=${claim.verdict}, confidence=${claim.confidence_score?.toFixed(2) ?? "N/A"}, ` +
        `source=${claim.evidence_url ?? "N/A"}, ` +
        `domain=${claim.vertical_domain})`;
      items.push(makeItem(
        runId,
        content,
        `citation.manus.space:claim_${claim.claim_id}`,
        "europe_pmc",
        {
          claim_id: claim.claim_id,
          verdict: claim.verdict,
          confidence_score: claim.confidence_score,
          pdb_id: claim.pdb_id,
          page_url: claim.page_url,
        }
      ));
    }
    sources.citation_manus_space = hivClaims.length;
    console.log(`[Cognition] citation.manus.space: +${hivClaims.length} verified HIV protease claims`);
  } catch (e) { console.warn("[Cognition] citation.manus.space failed:", (e as Error).message); }
  // ── Manual heuristics (always added) ────────────────────────────────────────
  const heuristics = [
    "HIV-1 protease is a homodimeric aspartyl protease (99 aa per monomer). Active site: Asp25-Thr26-Gly27. Flap region (45-55) controls substrate access. Key resistance mutations: D30N, V32I, M46I/L, I47V/A, G48V, I50L/V, I54L/M/V, L76V, V82A/F/T/S, I84V, N88D/S, L90M.",
    "Drug-likeness for HIV protease inhibitors: MW < 700, LogP 1-5, HBD ≤ 5, HBA ≤ 10, TPSA < 140 Å². Approved drugs: Saquinavir (MW=670), Ritonavir (MW=721), Indinavir (MW=614), Nelfinavir (MW=568), Lopinavir (MW=629), Atazanavir (MW=705), Darunavir (MW=548), Tipranavir (MW=603).",
    "pIC50 scoring: pIC50 = -log10(IC50 in M). Target: pIC50 > 9 (< 1 nM). Excellent: 8-9 (1-10 nM). Good: 7-8 (10-100 nM). Moderate: 6-7 (100-1000 nM). Best known: Darunavir pIC50 ~10.3 (IC50 ~0.005 nM).",
    "Pharmacophore for HIV protease inhibitors: (1) Central hydroxyl/transition-state isostere (hydroxyethylamine, hydroxyethylene) mimicking tetrahedral intermediate. (2) P2/P2' substituents filling S2/S2' pockets. (3) P1/P1' aromatic groups for S1/S1' pocket. (4) Flap-water hydrogen bond network.",
    "Scaffold diversity: Track A = ChEMBL top actives (hydroxyethylamine). Track B = PDB co-crystals (structure-guided). Track C = BindingDB curated (bis-THF, carbamate). Track D = novel scaffolds (macrocycles, fragments). Convergence candidates appear in 2+ tracks.",
    "Quantum scoring uses VQE (Variational Quantum Eigensolver) for electronic binding energy. Quantum advantage expected for flexible flap region (residues 45-55) where classical force fields have known limitations.",
    "ASI-Evolve loop: Learn (seed cognition from 10 public databases) → Design (Researcher LLM generates strategy via UCB1-sampled context) → Experiment (Engineer generates 200 candidates, RF ensemble + quantum VQE) → Analyze (Analyzer LLM extracts lessons, updates cognition). Repeat every 4 hours.",
  ];

  for (let i = 0; i < heuristics.length; i++) {
    items.push(makeItem(runId, heuristics[i], `manual:heuristic-${i + 1}`, "manual", { index: i }));
  }
  sources.manual = heuristics.length;

  if (items.length > 0) {
    await addCognitionBatch(items);
    console.log(`[Cognition] Seeded ${items.length} items from:`, sources);
  }

  return { added: items.length, sources };
}

/**
 * Incremental refresh — fetches new records from high-velocity sources.
 * Called every COGNITION_REFRESH_EVERY steps (default: 10).
 */
export async function refreshCognitionStore(runId: number): Promise<number> {
  const newItems: Omit<CognitionItem, "id">[] = [];
  console.log("[Cognition] Incremental refresh from high-velocity sources...");

  // Europe PMC — highest velocity (new papers daily)
  try {
    const epmc = await fetchEuropePMCRecords(10);
    for (const r of epmc) {
      newItems.push(makeItem(runId, europePMCToCognitionContent(r), `EuropePMC:${r.pmid || r.pmcid}`, "europe_pmc", {
        pmid: r.pmid, doi: r.doi,
      }));
    }
  } catch { /* non-fatal */ }

  // OpenAlex — large citation graph, good for trend detection
  try {
    const oaWorks = await fetchOpenAlexRecords(10);
    for (const w of oaWorks) {
      newItems.push(makeItem(runId, openAlexToCognitionContent(w), `OpenAlex:${w.id.split("/").pop()}`, "openAlex", {
        id: w.id, doi: w.doi,
      }));
    }
  } catch { /* non-fatal */ }

  // ChEMBL — new bioassay data
  try {
    const chembl = await fetchChEMBLRecords(20);
    for (const a of chembl) {
      if (a.pchembl_value >= 6.0) {
        newItems.push(makeItem(runId, chemblToCognitionContent(a), `ChEMBL:${a.chembl_id}`, "chembl", {
          chembl_id: a.chembl_id, pchembl_value: a.pchembl_value,
        }));
      }
    }
  } catch { /* non-fatal */ }

  // CrossRef — new DOIs
  try {
    const crWorks = await fetchCrossRefRecords(10);
    for (const w of crWorks) {
      newItems.push(makeItem(runId, crossRefToCognitionContent(w), `CrossRef:${w.doi}`, "crossRef", {
        doi: w.doi,
      }));
    }
  } catch { /* non-fatal */ }

  // citation.manus.space — incremental refresh using updatedSince cursor
  try {
    const lastRefresh = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // last 24h
    const citPage = await listClaimsByVertical("structural_biology", {
      pageSize: 50,
      updatedSince: lastRefresh,
      verdict: "Supported",
    });
    for (const claim of citPage.claims) {
      const content =
        `[citation.manus.space Verified] ${claim.claim_text} ` +
        `(verdict=${claim.verdict}, confidence=${claim.confidence_score?.toFixed(2) ?? "N/A"}, ` +
        `source=${claim.evidence_url ?? "N/A"}, ` +
        `domain=${claim.vertical_domain})`;
      newItems.push(makeItem(
        runId,
        content,
        `citation.manus.space:claim_${claim.claim_id}`,
        "europe_pmc", // closest source_type for external verified literature
        {
          claim_id: claim.claim_id,
          verdict: claim.verdict,
          confidence_score: claim.confidence_score,
          pdb_id: claim.pdb_id,
          page_url: claim.page_url,
        }
      ));
    }
    if (citPage.claims.length > 0) {
      console.log(`[Cognition] citation.manus.space: +${citPage.claims.length} verified claims (since ${lastRefresh})`);
    }
  } catch { /* non-fatal */ }

  if (newItems.length > 0) {
    await addCognitionBatch(newItems);
  }

  console.log(`[Cognition] Incremental refresh: +${newItems.length} items`);
  return newItems.length;
}
