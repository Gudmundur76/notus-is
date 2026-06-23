# notus.is — Architecture Overview

> **Phase-F** | Last updated: 2026-06-23

---

## System Summary

**notus.is** is an autonomous drug-discovery platform that runs a continuous 6-phase discovery-verification loop against 65 data sources across 12 scientific domains. Every 4 hours, the system discovers candidate molecules, scores them with an ML ensemble and quantum VQE, verifies the top claims against citation.manus.space, feeds verdicts into the ASI-Evolve cognition graph, and evolves the next discovery query using an LLM.

---

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Heartbeat Scheduler                         │
│  hiv-discovery-loop (00/04/08…)                                     │
│  hiv-verification-cycle (02/06/10…)                                 │
│  hiv-domain-scheduler (01/05/09…)                                   │
└──────────────────────┬──────────────────────────────────────────────┘
                       │  POST /api/scheduled/*
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    runVerificationCycle(domainConfig?)               │
│                                                                     │
│  Phase 1 DISCOVER   →  pythonBridge.query() — 65 adapters          │
│  Phase 2 SCORE      →  ML ensemble + quantumScore() VQE            │
│  Phase 3 VERIFY     →  verifyCandidates() → citation.manus.space   │
│  Phase 4 COGNITION  →  feedbackVerdictsToCognition() → evolve_db   │
│  Phase 5 EVOLVE     →  runEvolveStep() → evolveDiscoveryQuery()    │
│  Phase 6 CONVERGENCE→  detectConvergence() → loop_state update     │
└──────────────────────┬──────────────────────────────────────────────┘
                       │  persists to
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MySQL / TiDB                                │
│  verification_cycles  candidates  evolve_cognition  evolve_nodes   │
│  domain_cycle_summaries  loop_state  evolve_runs                   │
└──────────────────────┬──────────────────────────────────────────────┘
                       │  tRPC queries
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                           │
│  /verification-dashboard  — real-time monitoring                   │
│  /findings                — candidate explorer                     │
│  /methodology             — pipeline documentation                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Map

### Backend (`server/`)

| Module | Path | Responsibility |
|---|---|---|
| Express server | `server/_core/index.ts` | HTTP server, route registration, startup hooks |
| tRPC router | `server/routers/discovery.ts` | All discovery/verification API procedures |
| Auth router | `server/routers/auth.ts` | Manus OAuth login/logout/me |
| Python bridge | `server/discovery/python-bridge.ts` | Spawns `python3` adapters, returns `DiscoveryReport` |
| Verification cycle | `server/discovery/verification-cycle.ts` | 6-phase orchestrator |
| Candidate claims | `server/discovery/candidate-claim.ts` | `CandidateClaim`, `verifyCandidates`, `feedbackVerdictsToCognition` |
| Query evolver | `server/discovery/query-evolver.ts` | LLM-backed next-query generation |
| Domain configs | `server/discovery/domain-configs.ts` | 12 domain definitions |
| Domain scoring | `server/discovery/domain-scoring.ts` | 4 scoring strategies |
| Domain orchestrator | `server/discovery/asi-evolve/domain-orchestrator.ts` | Runs all 12 domains in sequence |
| ASI-Evolve orchestrator | `server/discovery/asi-evolve/orchestrator.ts` | Phase 5 EVOLVE step |
| Citation client | `server/discovery/asi-evolve/citation-client.ts` | citation.manus.space HTTP adapter |
| Predictor | `server/discovery/predictor.ts` | ML ensemble + quantum VQE |
| Convergence | `server/discovery/convergence.ts` | Termination criteria |
| Integration test | `server/discovery/integration-test.ts` | Runnable end-to-end diagnostic |

### Scheduled Handlers (`server/scheduled/`)

| File | Job name | Cron |
|---|---|---|
| `discovery-loop.ts` | `hiv-discovery-loop` | `0 0 0/4 * * *` |
| `verification-cycle-loop.ts` | `hiv-verification-cycle` | `0 0 2/4 * * *` |
| `domain-scheduler.ts` | `hiv-domain-scheduler` | `0 0 1/4 * * *` |

### Frontend (`client/src/`)

| Module | Path | Responsibility |
|---|---|---|
| App | `client/src/App.tsx` | Route definitions |
| Home | `client/src/pages/Home.tsx` | Landing page |
| Verification Dashboard | `client/src/pages/VerificationDashboard.tsx` | Real-time monitoring |
| Findings | `client/src/pages/Findings.tsx` | Candidate explorer |
| Methodology | `client/src/pages/Methodology.tsx` | Pipeline documentation |
| Verification components | `client/src/components/verification/` | 8 sub-components |
| DashboardLayout | `client/src/components/DashboardLayout.tsx` | Sidebar layout |

### Shared (`shared/`)

| Module | Path | Responsibility |
|---|---|---|
| Domain types | `shared/types/domain.ts` | `DomainId`, `DomainConfig`, 12 domain IDs |
| Shared constants | `shared/const.ts` | Error messages, timeouts |
| Shared types | `shared/types.ts` | Cross-boundary types |

---

## Data Sources

### TypeScript-native adapters (15)

Queried directly from `server/discovery/engineer.ts` via ChEMBL, PubChem, BindingDB, PDB, UniProt, DrugBank, OpenTargets, ZINC, Enamine, Mcule, Molport, eMolecules, ChEBI, AlphaFold, and STRING-DB REST APIs.

### Python adapters (50)

Spawned via `pythonBridge.query()` across `server/discovery/adapters/*.py`. Covers all 12 domain verticals:

| Domain | Adapters (sample) |
|---|---|
| Biomedical | pubchem, chembl, europe_pmc, biorxiv, cochrane, uniprot, pdb, bindingdb, drugbank, opentargets |
| Molecular | zinc, enamine, mcule, molport, emolecules, stdinchi, chebi |
| Protein | alphafold, pfam, interpro, string_db, biogrid, intact, reactome, kegg |
| Clinical | clinicaltrials, fda_drugs, ema, who_ictrp, pubmed, medrxiv |
| Climate | ipcc, noaa, nasa_earthdata, eea, epa, usgs, owid, copernicus |
| Economics | world_bank, imf, oecd, fred, eurostat, bis, un_comtrade |
| Law | eur_lex, federal_register, cfr, echr, icj, wipo, sec_edgar |
| Energy | iea, eia, irena, nrel, ember, entso_e |
| Nutrition | usda_fdc, efsa, openfoodfacts, nutritionix, fao |
| Materials | materials_project, aflow, oqmd, icsd, nomad, jarvis |
| Knowledge | ietf_rfc, w3c, iso_standards, nist, ieee_xplore, arxiv |
| Citation | crossref, semantic_scholar, openalex, unpaywall, core_ac |

---

## Quantum Scoring

The quantum VQE pipeline runs in Phase 2 of every verification cycle:

```
SMILES → angle encoding → VQE circuit (4 qubits) → binding affinity proxy [0,1]
```

Three backends with weighted ensemble (WuKong 50%, Quafu 30%, Jiuzhang 20%):

| Backend | Provider | Mode |
|---|---|---|
| WuKong | Origin Quantum Cloud | `WK_C180_2` (real HW) or `full_amplitude` (sim) |
| Quafu | BAQIS | ScQ hardware |
| Jiuzhang | USTC | Photonic (proxy via WuKong until API is public) |

Provenance is recorded per candidate: `QUANTUM_DUAL`, `QUANTUM_SIM`, or `CLASSICAL`.

---

## Scheduling

Three interleaved Heartbeat jobs produce **18 cycle events per day**:

```
Hour:  00  01  02  03  04  05  06  07  08  09  10  11  12 …
       DL  DS  VC  DL  DS  VC  DL  DS  VC  DL  DS  VC  DL …

DL = hiv-discovery-loop
DS = hiv-domain-scheduler
VC = hiv-verification-cycle
```

Each job fires every 4 hours, offset by 1 hour from each other, preventing DB contention.

---

## Test Coverage

| File | Tests | Coverage |
|---|---|---|
| `verification-cycle.test.ts` | 14 | 6-phase orchestrator |
| `candidate-claim.test.ts` | 33 | Claim building, verification, cognition feedback |
| `query-evolver.test.ts` | 22 | LLM query evolution, fallback |
| `domain-scoring.test.ts` | 26 | All 4 scoring strategies |
| `python-bridge.test.ts` | 8 | Adapter query, error handling |
| `auth.logout.test.ts` | 2 | Auth logout flow |
| **Total** | **115** | |

Run all tests: `pnpm test`
