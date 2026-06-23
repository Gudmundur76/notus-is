# ASI-Evolve Architecture — notus.is Implementation Design

**Source of truth:** [GAIR-NLP/ASI-Evolve](https://github.com/GAIR-NLP/ASI-Evolve)  
**Domain:** HIV Protease Inhibitor Discovery  
**Date:** 2026-06-23

---

## 1. What ASI-Evolve Is

ASI-Evolve is a general agentic framework that closes the loop between **knowledge → hypothesis → experiment → analysis** and repeats it autonomously. It was validated on neural architecture design, pretraining data curation, RL algorithm design, and biomedical drug-target interaction — all frontier-level results produced without human intervention.

The core loop has four stages:

| Stage | Action | ASI-Evolve Role |
|---|---|---|
| **Learn** | Sample prior nodes from DB + retrieve cognition | Researcher reads memory |
| **Design** | Propose next candidate (patch / rewrite / branch) | Researcher writes code |
| **Experiment** | Execute evaluator, collect structured metrics | Engineer runs eval |
| **Analyze** | Distill outcome into reusable lessons | Analyzer writes analysis |

Two memory systems keep the loop from going in circles:

- **Cognition Store** — external knowledge: papers, heuristics, PubMed abstracts, PDB binding data. Queried semantically (FAISS + sentence-transformers). Immutable once seeded per round.
- **Experiment Database** — every trial: motivation, code, results, analysis, lineage, score. Sampled using UCB1 / greedy / random / island algorithms. The source of truth for what has been tried and what worked.

---

## 2. How This Maps to notus.is

### 2.1 The Candidate

In ASI-Evolve, the "program" being evolved is Python code. In notus.is, the "program" is a **scoring and generation strategy** — a TypeScript module that:

1. Selects seed molecules from the corpus
2. Applies chemical transformations (scaffold mutations, substituent changes)
3. Scores candidates using the ML ensemble + quantum predictor
4. Returns a structured result: `{ score, pic50, admet, smiles, track }`

The evaluator is deterministic: given a strategy (code), it runs the strategy against the HIV protease corpus and returns `eval_score = mean_pic50_of_top_10_verified_candidates`.

### 2.2 The Evaluator Contract

Following ASI-Evolve's engineer contract exactly:

```
Input:  steps/<step-name>/code          ← the strategy module (TypeScript)
Output: steps/<step-name>/results.json  ← must contain { eval_score, success, ... }
```

The evaluator:
1. Loads the strategy module
2. Runs it against the corpus (44 seed records + all verified candidates)
3. Scores the top 10 candidates by predicted pIC50
4. Verifies them against PubMed/PDB/ChEMBL
5. Returns `eval_score = mean_pic50_of_verified_top_10`

### 2.3 The Cognition Store

Seeded from **verified public databases**:

| Source | Content | Update Frequency |
|---|---|---|
| **PubMed** (NCBI E-utilities) | HIV protease inhibitor abstracts, binding affinity data | Per cycle |
| **PDB** (RCSB REST API) | Co-crystal structure summaries, binding pocket geometry | Per cycle |
| **ChEMBL** (REST API) | Bioassay records, IC50 values, structure-activity relationships | Per cycle |
| **BindingDB** (REST API) | Curated binding affinities for HIV protease | Per cycle |
| **UniProt** (REST API) | HIV protease protein sequence, active site residues | Once |

Each cognition item has:
```json
{
  "content": "Compound X (SMILES: ...) shows IC50=2.3nM against HIV-1 protease (PDB:1HXW). Key contacts: Asp25, Asp125.",
  "source": "PubMed:12345678",
  "metadata": { "pic50": 8.64, "year": 2023, "assay_type": "Ki" }
}
```

### 2.4 The Experiment Database

Each node represents one evolution step:

```json
{
  "id": 42,
  "name": "scaffold_bis_thf_p2_extension_v3",
  "motivation": "PDB co-crystal analysis shows P2 pocket has room for a larger bis-THF group. Track C parent scored 8.9 but TPSA=142 (too high). This patch reduces TPSA by replacing one THF with a smaller oxetane.",
  "code": "// TypeScript strategy module\nexport function generateCandidates(corpus) { ... }",
  "results": {
    "eval_score": 9.14,
    "top10_mean_pic50": 9.14,
    "top10_verified_count": 7,
    "best_smiles": "CC(C)(C)...",
    "best_pic50": 9.41,
    "admet_pass_rate": 0.82,
    "track": "C"
  },
  "analysis": "The oxetane substitution reduced TPSA from 142 to 118 while maintaining the P2 pocket fill. 7/10 top candidates verified against PubMed. Best pIC50 improved from 8.9 to 9.41. Key lesson: oxetane is a viable TPSA reducer for bis-THF scaffolds without losing binding affinity.",
  "score": 9.14,
  "parent": [38, 41],
  "visit_count": 3
}
```

### 2.5 Sampling Algorithm

**UCB1** (default) — balances exploration vs exploitation. Exploration constant `c = 1.414`. After 30+ nodes, switch to `island` sampling with features `[complexity=len(code), diversity=tanimoto_distance_from_best]` to maintain structural diversity.

### 2.6 The Four-Stage Loop in notus.is

```
Every 4 hours (Manus Heartbeat):

LEARN:
  1. Sample 3 parent nodes from experiment DB (UCB1)
  2. Retrieve 5 cognition items relevant to parent motivation
  3. Fetch fresh PubMed/ChEMBL records for the current best scaffold

DESIGN (LLM — invokeLLM):
  System: "You are a medicinal chemist designing HIV protease inhibitors."
  Context: parent nodes + cognition items + current best pIC50
  Output: <name>, <motivation>, <code> (TypeScript strategy module)

EXPERIMENT:
  1. Execute the strategy module against the corpus
  2. Score top 10 candidates (ML ensemble + quantum)
  3. Verify against PubMed/PDB/ChEMBL
  4. Write results.json: { eval_score, success, metrics }

ANALYZE (LLM — invokeLLM):
  Input: code + results + best_sampled_node
  Output: <analysis> — what worked, what failed, key lessons
  Store: node persisted to experiment DB + MySQL candidates table
```

---

## 3. Database Schema Changes

The existing MySQL tables are preserved. New tables added:

| Table | Purpose |
|---|---|
| `evolve_nodes` | ASI-Evolve experiment database (Node records) |
| `evolve_cognition` | ASI-Evolve cognition store (CognitionItem records) |
| `evolve_runs` | Run metadata: name, start_time, step_count, best_score |

The existing `candidates`, `cycles`, `corpus`, `convergence_candidates` tables remain as the **output layer** — they store the best verified molecules for the frontend dashboard.

---

## 4. Public Database Integration

All external data is fetched via **verified, rate-limited REST APIs** — no scraping, no hallucination:

| API | Base URL | Auth | Rate Limit |
|---|---|---|---|
| NCBI E-utilities (PubMed) | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/` | API key (free) | 10 req/s |
| RCSB PDB | `https://data.rcsb.org/rest/v1/` | None | 10 req/s |
| ChEMBL | `https://www.ebi.ac.uk/chembl/api/data/` | None | 1 req/s |
| BindingDB | `https://bindingdb.org/axis2/services/BDBService` | None | 1 req/s |
| UniProt | `https://rest.uniprot.org/uniprotkb/` | None | 1 req/s |

---

## 5. What Changes vs. Current Implementation

| Current (custom loop) | New (ASI-Evolve faithful) |
|---|---|
| Fixed 4-track molecule generator | LLM-driven strategy evolution — the Researcher proposes the next generation strategy |
| Hardcoded SMILES mutations | Diff-based evolution: Researcher patches the previous best strategy |
| No memory of why something worked | Analyzer writes structured lessons stored in experiment DB |
| No parent selection | UCB1 sampling selects the most informative parent |
| Citation gate as binary pass/fail | Verification score feeds into `eval_score` |
| No cognition store | Cognition store seeded from PubMed/PDB/ChEMBL abstracts |
| Quantum score as separate module | Quantum score is one metric in `results.json` |

---

## 6. File Structure

```
server/
  discovery/
    asi-evolve/
      database.ts          ← Node database (UCB1/greedy/random/island)
      cognition.ts         ← CognitionItem store (FAISS-equivalent: cosine similarity)
      researcher.ts        ← LLM agent: proposes next strategy
      engineer.ts          ← Executes strategy, runs evaluator, writes results.json
      analyzer.ts          ← LLM agent: distills lessons from results
      pipeline.ts          ← Orchestrates the 4-stage loop
      evaluator.ts         ← The domain evaluator: runs strategy against corpus
      public-db.ts         ← PubMed / PDB / ChEMBL / BindingDB fetchers
      cognition-seeder.ts  ← Seeds cognition from public DBs
      prompts/
        researcher.ts      ← Jinja2-equivalent: researcher system prompt
        analyzer.ts        ← Jinja2-equivalent: analyzer system prompt
```

---

## 7. Evaluator Score Definition

```
eval_score = (0.6 × mean_pic50_top10) + (0.3 × verification_rate) + (0.1 × admet_pass_rate)

where:
  mean_pic50_top10    = mean predicted pIC50 of top 10 candidates
  verification_rate   = fraction of top 10 verified against PubMed/PDB/ChEMBL (0–1)
  admet_pass_rate     = fraction of top 10 passing all ADMET filters (0–1)
```

This is the single scalar `score` stored in each Node and used by UCB1 for parent selection.

---

## 8. Preflight Checklist (per SKILL.md)

Before the first evolution round:

- [x] Objective defined: maximize `eval_score` for HIV protease inhibitor candidates
- [x] Core score: `eval_score` (composite of pIC50, verification, ADMET)
- [x] Evaluation command: `executeEvaluator(strategyCode)` → `results.json`
- [x] Evaluation timeout: 300 seconds per step
- [x] Success criteria: `eval_score ≥ 9.5` (pIC50 ≈ 0.3 nM IC50)
- [x] Stop conditions: 100 rounds OR `eval_score ≥ 9.5` OR 30 days elapsed
- [x] Writable scope: `server/discovery/asi-evolve/` only
- [x] Sampling algorithm: UCB1 (c=1.414), switch to island after 30 nodes
- [x] Cognition sources: PubMed, PDB, ChEMBL, BindingDB, UniProt
- [x] Mutation scope: TypeScript strategy modules only
