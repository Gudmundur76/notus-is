# notus.is — Autonomous Multi-Domain Discovery Engine

> **Autonomously searches 65 scientific data sources, scores candidates with quantum computing, verifies claims against [citation.manus.space](https://citation.manus.space), and learns from every cycle via ASI-Evolve.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://python.org/)
[![Tests](https://img.shields.io/badge/tests-130%20passing-brightgreen)](./server/)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

---

## Overview

**notus.is** is a unified discovery-verification platform that runs a continuous 6-phase autonomous loop across 12 scientific domains. Every four hours the system discovers candidate entities, scores them with a classical ML ensemble augmented by quantum VQE, verifies the top claims against a citation graph, feeds verdicts into the ASI-Evolve cognition store, and evolves the next discovery query using an LLM — producing a peer-reviewable scientific document at day 30.

```
Heartbeat (every 4 h)
  │
  ├─ Phase 1  DISCOVER    → 65 data-source adapters (Python bridge)
  ├─ Phase 2  SCORE       → ML ensemble + quantum VQE (WuKong / Quafu)
  ├─ Phase 3  VERIFY      → citation.manus.space claim verification
  ├─ Phase 4  COGNITION   → ASI-Evolve cognition graph update
  ├─ Phase 5  EVOLVE      → LLM query evolution
  └─ Phase 6  CONVERGENCE → convergence detection → loop state
```

---

## 12 Discovery Domains

| Domain | Focus |
|---|---|
| **Biomedical** | Drug candidates, disease mechanisms, clinical evidence |
| **Molecular** | Small molecules, SMILES, binding affinity, ADMET |
| **Protein** | Protein structures, folding predictions, interaction networks |
| **Clinical** | Trial outcomes, safety signals, efficacy endpoints |
| **Climate** | Atmospheric data, emissions, climate model outputs |
| **Economics** | Macroeconomic indicators, market data, policy analysis |
| **Law** | Legislation, case law, regulatory filings |
| **Energy** | Renewable capacity, grid data, energy policy |
| **Nutrition** | Dietary evidence, nutrient databases, health outcomes |
| **Materials** | Novel materials, synthesis routes, property prediction |
| **Knowledge** | Cross-domain synthesis, ontology linking |
| **Citation** | Citation graph traversal, claim provenance, retraction detection |

---

## 65 Data Sources

### Biomedical & Molecular
PubChem · ChEMBL · UniProt · AlphaFold DB · Europe PMC · PubMed · bioRxiv · medRxiv · Cochrane Library · DrugBank · BindingDB · RCSB PDB · KEGG · Reactome · STRING · SwissADME *(key required)* · ZINC · ChEBI · HMDB · PharmGKB

### Clinical & Protein
ClinicalTrials.gov · WHO ICTRP · FDA Adverse Events (FAERS) · OpenTargets · DisGeNET · OMIM · GeneCards · GTEx · ENCODE · Human Protein Atlas

### Literature & Citation
OpenAlex · Semantic Scholar · CrossRef · CORE · arXiv · SSRN · Unpaywall · Retraction Watch · citation.manus.space

### Climate & Environment
IPCC Data Distribution Centre · NOAA Climate Data · NASA Earthdata · Copernicus Climate Change Service · Global Carbon Project · IEA Energy Data

### Economics & Finance
World Bank DataBank · IMF Data · FRED (St. Louis Fed) · OECD Statistics · UN Comtrade · BIS Statistics · SEC EDGAR · Eurostat

### Law & Regulation
EUR-Lex · CourtListener · Congress.gov · UK Legislation · WIPO PATENTSCOPE · EPO Open Patent Services

### Energy & Materials
NREL Data Catalogue · EIA Open Data · Materials Project · AFLOW · NOMAD Repository · Open Quantum Materials Database

---

## Quantum Integration

notus.is uses a **Variational Quantum Eigensolver (VQE)** to compute binding-affinity proxies that augment the classical ML pIC50 prediction:

```
pic50_vqe = base_pic50 × (1 + 0.1 × quantum_score)
```

| Backend | Weight | Hardware | Provider |
|---|---|---|---|
| **WuKong** | 50% | 180-qubit superconducting | [Origin Quantum Cloud](https://qcloud.originqc.com.cn) |
| **Quafu** | 30% | ScQ superconducting chip | [BAQIS](https://quafu.baqis.ac.cn) |
| **Jiuzhang 4.0** | 20% | 3,050-photon GBS *(future)* | USTC |

All backends fall back to a classical CPU heuristic when the API is unreachable. The `quantumProvenance` field on every candidate records which path was taken (`QUANTUM_DUAL` · `QUANTUM_SIM` · `CLASSICAL`).

See [docs/QUANTUM.md](./docs/QUANTUM.md) for activation instructions.

---

## Architecture

The platform is a full-stack TypeScript monorepo with a Python discovery bridge:

```
client/          React 19 + Vite + Tailwind 4 + tRPC client
server/          Express 4 + tRPC 11 + Drizzle ORM
  _core/         OAuth, LLM, image generation, storage, heartbeat
  discovery/     6-phase loop, quantum scoring, ASI-Evolve, report generator
  routers/       tRPC procedure definitions
drizzle/         Schema, migrations (MySQL / TiDB)
docs/            Architecture, deployment, quantum, ASI-Evolve docs
scripts/         setup.sh — automated 6-step project setup
```

Full architecture diagram and component map: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Quick Start

### 1. Clone and set up

```bash
git clone https://github.com/Gudmundur76/notus-is.git
cd notus-is
./scripts/setup.sh          # checks prereqs, installs deps, creates .env
```

The setup script accepts `--skip-python`, `--skip-db`, and `--skip-diag` flags. Run `./scripts/setup.sh --help` for details.

### 2. Configure environment

Edit `.env` (created by setup.sh) and fill in the required values:

```dotenv
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/notus
APP_URL=http://localhost:3000

# Python discovery engine
PYTHON_DISCOVERY_PATH=/path/to/asi-evolve-discovery-engine/main.py

# Optional — quantum hardware
ORIGIN_QUANTUM_API_KEY=

# Optional — citation verification
CITATION_API_KEY=
CITATION_BASE_URL=https://citation.manus.space

# Optional — LLM (ASI-Evolve query evolution)
OPENAI_API_KEY=

# Optional — FRED economic data
FRED_API_KEY=
```

### 3. Apply database schema

```bash
pnpm db:push
```

### 4. Start the development server

```bash
pnpm dev
# → http://localhost:3000
```

### 5. Verify the installation

```bash
npx tsx server/discovery/integration-test.ts
```

Full deployment guide (production, Docker, Manus platform): [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

## Key Pages

| Route | Description |
|---|---|
| `/` | Live stats, 4-track overview, 30-day timeline |
| `/findings` | Verified candidates with confidence scores and SMILES |
| `/verification-dashboard` | Real-time cycle monitoring, domain breakdown, Download Report |
| `/methodology` | Full 6-phase pipeline documentation |
| `/contact` | Contact form |

---

## Day-30 Report

At any point during the 30-day run, click **Day 30 Report →** in the Verification Dashboard header to download a peer-reviewable markdown document containing:

- Executive summary with mean confidence and best pIC50
- Top-N candidates ranked by drug-likeness and quantum score
- Domain-by-domain support rates
- Daily progression and ASI-Evolve best step
- Full SMILES, provenance, and citation references

---

## Development

```bash
pnpm test           # run 130 Vitest tests
pnpm check          # TypeScript type-check
pnpm db:push        # apply Drizzle migrations
pnpm build          # production build → dist/
pnpm diagnostic     # run integration diagnostic (requires DATABASE_URL)
pnpm test-quantum   # run quantum backend smoke test
pnpm setup          # re-run the automated setup script
```

---

## Documentation

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture, component map, data flow |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Full deployment guide (dev, prod, Manus platform) |
| [docs/QUANTUM.md](./docs/QUANTUM.md) | Quantum hardware activation (WuKong, Quafu) |
| [docs/asi-evolve-architecture.md](./docs/asi-evolve-architecture.md) | ASI-Evolve cognition graph and query evolution |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui, Framer Motion |
| Backend | Node.js 22, Express 4, tRPC 11, Drizzle ORM |
| Database | MySQL 8 / TiDB (Drizzle schema-first migrations) |
| Auth | Manus OAuth 2.0 (JWT session cookies) |
| Discovery | Python 3.10+, httpx, biopython, RDKit, scikit-learn |
| Quantum | pyqpanda3 (WuKong VQE), Quafu SDK |
| LLM | Manus built-in LLM API (claude / gpt-5 / gemini) |
| Storage | S3-compatible object storage (Manus built-in) |
| Testing | Vitest 3, 130 tests across 9 test files |

---

## License

MIT — see [LICENSE](./LICENSE)
