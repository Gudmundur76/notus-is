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

## Pending / Future

- [ ] Seed corpus on first cycle (auto-bootstrap from hiv_protease_corpus.json)
- [ ] Day-30 report generation — PDF/markdown export of top convergence candidates
- [ ] Email notification when best pIC50 exceeds threshold
- [ ] SwissADME integration for ADMET verification
- [ ] Quantum hardware upgrade — real IBM/Quafu backend when available
