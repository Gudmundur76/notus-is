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

## ASI-Evolve Phase 4 (Exact Source Fidelity)

- [x] Embedding service — LLM-based text embeddings replacing TF-IDF (embedding.ts)
- [x] Vector similarity index — dense cosine similarity replacing in-memory TF-IDF map (vector-index.ts)
- [x] Island sampling algorithm — MAP-Elites with feature dimensions, migration, archive (island-sampler.ts)
- [x] Manager agent — LLM generates optimized prompts for Researcher and Analyzer (manager.ts)
- [x] SEARCH/REPLACE diff engine — parse and apply <<<<<<< SEARCH / >>>>>>> REPLACE blocks (diff.ts)
- [x] researcher_diff prompt — Researcher generates diffs against base code (incremental evolution) (researcher.ts)
- [x] BestSnapshotManager — persist best-scoring step outputs to DB (best-snapshot.ts)
- [x] Run state persistence — serialize full run state (managedPrompts, islandSampler, stepCount, bestScore) for resumability across server restarts (run-state.ts)

## Phase 5 — citation.manus.space Integration (Verification Layer)

The ttruthdesk-platform at citation.manus.space is the external truth verification layer.
Every best candidate and every ASI-Evolve analysis must be submitted there for claim-level verdict.
The verified claims corpus also feeds back into the cognition store as ground truth.

### Citation Client (server/discovery/asi-evolve/citation-client.ts)
- [x] verifyClaim(claim: string) — POST /api/public/verify-claim, returns verdict + confidence + evidence
- [x] submitDocument(title, rawText) — POST /api/trpc/documents.create, returns documentId
- [x] pollDocumentStatus(docId) — GET /api/trpc/documents.get, polls until complete/failed
- [x] searchClaims(q, vertical?) — GET /api/public/claims/search, returns matching verified claims
- [x] listClaimsByVertical(vertical, updatedSince?) — GET /api/public/claims paginated

### Verifier Integration (server/discovery/asi-evolve/verifier.ts)
- [x] After each ASI-Evolve step: submit the step analysis text as a document to citation.manus.space
- [x] Verify top-3 candidate claims ("Compound X shows pIC50=Y against HIV-1 protease") via verifyClaim
- [x] Store citation verdict (Supported/Contradicted/Ambiguous) on evolve_nodes.metadata.citationVerdict
- [x] Boost eval_score by +0.5 for Supported verdicts, penalise -0.3 for Contradicted

### Cognition Seeder Integration (server/discovery/asi-evolve/cognition-seeder.ts)
- [x] On startup: pull latest 200 structural_biology claims from citation.manus.space via listClaimsByVertical
- [x] Convert each verified claim to a CognitionItem and upsert into evolve_cognition
- [x] On each cycle: incremental refresh using updatedSince cursor (last seeded timestamp)

### Database
- [x] Add citation_verdict, citation_doc_id, citation_confidence columns to evolve_nodes (ALTER TABLE applied + orchestrator writes them)

### tRPC
- [x] discovery.citationVerifyClaim, citationSearchClaims, citationLatestClaims, citationVerifyCandidate — 4 tRPC procedures added
- [x] discovery.submitForVerification — citationVerifyCandidate handles on-demand verification

### Frontend
- [x] Dashboard: citation verdict badge on best candidate card (Supported / Contradicted / Ambiguous) — links to citation.manus.space
- [x] Findings page: citation verdict badge on each CandidateCard — CITE: Supported/Contradicted/Ambiguous badge with link
