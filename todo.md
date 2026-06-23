# notus.is — HIV Protease Discovery Engine TODO

## Core Engine

- [x] Database schema — 6 tables: corpus, cycles, candidates, convergence_candidates, loop_state, citation_records
- [x] Corpus data — 44 HIV protease inhibitor seeds from ChEMBL/PDB/BindingDB
- [x] Chemistry module — RDKit WASM fingerprints, Tanimoto similarity, ADMET descriptors
- [x] ML ensemble predictor — 10-model Random Forest ensemble, pIC50 prediction
- [x] Quantum predictor — Quafu/IBM quantum backend integration (QAOA-inspired scoring)
- [x] Multi-track molecule engineer — 4 tracks (A/B/C/D), scaffold mutation, 50 candidates/track
- [x] Citation gate — 8-stage PubMed/PDB/UniProt verification pipeline
- [x] Convergence detector — cross-track consensus analysis, Tanimoto clustering
- [x] Discovery loop orchestrator — full micro-cycle: seed → generate → score → verify → converge
- [x] Heartbeat scheduler — registered cron job (every 4 hours, 6 cycles/day, 180 cycles/30 days)
- [x] Scheduled callback endpoint — POST /api/scheduled/discovery-loop

## ASI-Evolve Faithful Port (Phase 2)

- [x] ASI-Evolve types — EvolveNode, CognitionItem, EvolveRun, EvolveResults
- [x] Experiment database — UCB1/greedy/random sampling, node persistence, run management
- [x] Cognition store — TF-IDF cosine similarity retrieval, semantic memory
- [x] Researcher agent — LLM-driven strategy generation using cognition context
- [x] Engineer agent — executes strategy, generates candidates, scores with ML + quantum
- [x] Analyzer agent — LLM-driven analysis, extracts lessons, updates cognition store
- [x] ASI-Evolve orchestrator — 4-stage Learn/Design/Experiment/Analyze loop
- [x] ASI-Evolve database tables — evolve_runs, evolve_nodes, evolve_cognition
- [x] ASI-Evolve tRPC procedures — evolveStatus, evolveNodes, evolveBestNode

## ttruthdesk Source Integration (Phase 3 — all 10 sources)

- [x] PubChem — 115M+ compounds, SMILES, bioassay activity (AID 1851)
- [x] ChEMBL — IC50/Ki/Kd for HIV protease CHEMBL247 + CHEMBL2093872
- [x] RCSB PDB — co-crystal structures, binding pocket residues
- [x] UniProt — HIV-1 protease sequence, active site annotations (P04585)
- [x] AlphaFold DB — predicted structures for HIV-1 protease (P04585)
- [x] Europe PMC — 40M+ open-access life sciences articles
- [x] OpenAlex — 250M+ works, citation graph
- [x] Semantic Scholar — 200M+ papers, semantic search
- [x] ClinicalTrials.gov — 450K+ studies, HIV protease inhibitor trials
- [x] CrossRef — DOI citation registry, retraction detection
- [x] cognition-seeder.ts — seeds from all 10 sources with incremental refresh
- [x] engineer.ts — live seeds from PubChem + ChEMBL (4h cache, static fallback)
- [x] verifier.ts — parallel verification against all 10 sources with confidence scoring

## API (tRPC)

- [x] discovery.stats — live corpus/candidate/cycle statistics
- [x] discovery.loopStatus — real-time loop running status
- [x] discovery.candidates — paginated, filterable candidate library
- [x] discovery.cycles — cycle history with metrics
- [x] discovery.trackDistribution — per-track candidate counts
- [x] discovery.bestCandidates — top N verified candidates by pIC50
- [x] discovery.triggerCycle — manual cycle trigger (admin)

## Frontend

- [x] Home page — live stats from tRPC (corpus records, candidates, best pIC50, day counter)
- [x] Dashboard page — live loop status, track distribution, cycle history, best candidates
- [x] Findings page — live candidate library with filters, pagination, CSV export
- [x] Navbar — Dashboard link added
- [x] App.tsx — /dashboard route registered

## Tests

- [x] discovery.stats — shape validation, corpusSize >= 0, dayNumber 1-30
- [x] discovery.loopStatus — shape validation
- [x] discovery.candidates — pagination, pageSize limit, minPic50 filter, track filter
- [x] discovery.cycles — pagination shape
- [x] discovery.trackDistribution — all 4 tracks present
- [x] discovery.bestCandidates — sorted by pIC50 descending

## Long-term Research Milestones

- [ ] Day-30 report generation — PDF/markdown export of top convergence candidates (requires 30 days data)
- [ ] SwissADME integration — requires registered API key
- [ ] Quantum hardware upgrade — real IBM/Quafu backend when credentials available
