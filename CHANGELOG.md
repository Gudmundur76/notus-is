# Changelog

All notable changes to **notus.is** are documented here.

---

## [Phase-F] — 2026-06-23 — Final Integration

### Added
- `server/discovery/integration-test.ts` — runnable end-to-end diagnostic (`npx tsx server/discovery/integration-test.ts`) that exercises all 5 pipeline stages and writes `/tmp/integration-report.json`
- `docs/DEPLOYMENT.md` — complete deployment guide covering prerequisites, env vars, DB setup, Python environment, quantum activation, build, Heartbeat scheduler, and health check
- `docs/ARCHITECTURE.md` — system architecture overview with data flow diagram, component map, data source inventory, scheduling table, and test coverage summary
- `docs/QUANTUM.md` — quantum hardware activation guide for WuKong (Origin Quantum Cloud), Quafu (BAQIS), and Jiuzhang (USTC) backends
- `CHANGELOG.md` — this file

### Changed
- `server/discovery/integration-test.ts` — uses `CandidateClaim[]` directly for dry-run verification, avoiding dependency on DB `Candidate` rows

---

## [Phase-E] — 2026-06-23 — Cross-Domain Expansion

### Added
- `shared/types/domain.ts` — `DomainId` union (12 domains), `DomainConfig` interface, `DEFAULT_DOMAIN_ID`
- `server/discovery/domain-configs.ts` — 12 `DomainConfig` objects: biomedical, molecular, protein, clinical, climate, economics, law, energy, nutrition, materials, knowledge, citation
- `server/discovery/domain-scoring.ts` — 4 scoring strategies: `molecular` (pIC50 + Lipinski), `economic` (magnitude + confidence), `text` (relevance + novelty), `numeric` (z-score + trend); `scoreByStrategy()`, `filterByGate()`, `topN()`
- `server/discovery/domain-scoring.test.ts` — 26 tests covering all 4 strategies
- `server/discovery/asi-evolve/domain-orchestrator.ts` — `runSingleDomain()`, `runDomainBatch()`, `getTodayDomainSummaries()`
- `server/scheduled/domain-scheduler.ts` — third Heartbeat job `hiv-domain-scheduler` at `0 0 1/4 * * *`
- `client/src/components/verification/DomainSelector.tsx` — 12-domain filter dropdown + card grid
- `client/src/components/verification/DomainStats.tsx` — per-domain aggregate statistics panel

### Changed
- `drizzle/schema.ts` — added `domain_id VARCHAR(64)` to `verificationCycles`; added `domain_cycle_summaries` table
- `server/discovery/verification-cycle.ts` — `runVerificationCycle()` now accepts optional `DomainConfig` parameter; `domain_id` persisted to DB
- `server/routers/discovery.ts` — added `domainConfigs`, `domainStats`, `triggerDomainCycle` tRPC procedures
- `server/_core/index.ts` — wired domain-scheduler route and startup registration
- `client/src/pages/VerificationDashboard.tsx` — added Cycle Monitor / Domain Stats tab switcher with domain filtering

---

## [Phase-D] — 2026-06-23 — Real-Time Monitoring Dashboard

### Added
- `client/src/components/verification/CycleStatusCard.tsx` — animated status badge, elapsed time, phase counter
- `client/src/components/verification/PhaseProgressBar.tsx` — 6-phase horizontal bar with amber pulse for running phase
- `client/src/components/verification/StatsCards.tsx` — Total Claims Verified, Support Rate, Best pIC50 cards
- `client/src/components/verification/TrendChart.tsx` — Recharts `LineChart` of best pIC50 over last 30 cycles
- `client/src/components/verification/CycleHistoryTable.tsx` — paginated table with drill-down modal
- `client/src/components/verification/VerdictBreakdown.tsx` — Recharts `PieChart` donut of verdict distribution
- `client/src/components/verification/index.ts` — barrel export
- `client/src/pages/VerificationDashboard.tsx` — main dashboard page with 30s/60s polling
- Route `/verification-dashboard` and **Verification** nav link

---

## [Phase-C-ext] — 2026-06-23 — tRPC Monitoring Procedures

### Added
- `trpc.discovery.verificationCycleStatus` — current/most recent cycle status (idle/running/completed/failed)
- `trpc.discovery.verificationCycleHistory` — paginated history, newest first
- `trpc.discovery.verificationStats` — aggregate stats: total claims, support rate, best pIC50, convergence flag

### Changed
- `server/discovery/verification-cycle.ts` — added `getVerificationCycleStatus()`, `getVerificationCycleHistory()`, `getVerificationStats()` DB helpers

---

## [Phase-C-sched] — 2026-06-23 — Second Heartbeat Cron Job

### Added
- `server/scheduled/verification-cycle-loop.ts` — Heartbeat handler for `hiv-verification-cycle` at `0 0 2/4 * * *`
- `registerVerificationCycleHeartbeat()` — idempotent registration on startup

### Changed
- `server/_core/index.ts` — wired second Heartbeat job route and startup registration

---

## [Phase-F-pre / Phase-C] — 2026-06-23 — Unified VerificationCycle

### Added
- `drizzle/schema.ts` — `verification_cycles` table (16 columns) and `VerificationCycleRow` type
- `server/discovery/verification-cycle.ts` — `runVerificationCycle()` 6-phase orchestrator: DISCOVER, SCORE, VERIFY, COGNITION, EVOLVE, CONVERGENCE
- `server/discovery/verification-cycle.test.ts` — 14 tests
- `trpc.discovery.verificationCycles` — paginated list
- `trpc.discovery.latestVerificationCycle` — most recent cycle
- `trpc.discovery.triggerVerificationCycle` — owner-only manual trigger

### Changed
- `server/scheduled/discovery-loop.ts` — Heartbeat handler now calls `runVerificationCycle()` as the unified engine

---

## [Phase-E-pre] — 2026-06-23 — Query Evolution

### Added
- `server/discovery/query-evolver.ts` — `evolveDiscoveryQuery()` with LLM-backed structured prompt and deterministic fallback; `buildFallbackQuery()`; `EvolvedQuery` type
- `server/discovery/query-evolver.test.ts` — 22 tests
- `trpc.discovery.evolveQuery` — mutation that auto-reads DB context when called without input

### Changed
- `server/discovery/asi-evolve/orchestrator.ts` — Phase 4 now calls `evolveDiscoveryQuery()` after Analyze; `evolved_query` added to `runEvolveStep()` return type

---

## [Phase-D-pre] — 2026-06-23 — feedbackVerdictsToCognition

### Added
- `feedbackVerdictsToCognition()` in `server/discovery/candidate-claim.ts` — verdict-specific priority, `source_type`, natural-language content framing, soft-upsert deduplication
- 13 new tests in `candidate-claim.test.ts`

### Changed
- `server/discovery/verification-cycle.ts` — Phase 4 COGNITION replaced with single `feedbackVerdictsToCognition()` call

---

## [Phase-C-pre] — 2026-06-23 — CandidateClaim / verifyCandidates

### Added
- `server/discovery/candidate-claim.ts` — `CandidateClaim`, `VerifiedCandidate`, `CitationClient` interface, `buildCandidateClaims()`, `verifyCandidates()`, `createRealCitationClient()`
- `server/discovery/candidate-claim.test.ts` — 20 tests covering all verdict branches
- `trpc.discovery.verifiedCandidates` — query with `limit`, `track`, `minPic50` filters

### Changed
- `server/discovery/verification-cycle.ts` — Phase 3 VERIFY upgraded from ad-hoc to `VerifiedCandidate`; Phase 4 COGNITION seeds full citation metadata

---

## [Phase-A / Phase-B] — 2026-06-22 — Initial Build

### Added
- Full React 19 + Tailwind 4 + Express 4 + tRPC 11 stack
- Manus OAuth authentication
- ASI-Evolve 6-agent cognition loop (Seeder, Researcher, Analyzer, Verifier, Synthesizer, Manager)
- Python bridge with 50 adapters across 12 domains
- 15 TypeScript-native ChEMBL/PubChem/PDB adapters
- ML ensemble predictor (`trainEnsemble`, `predictBatch`)
- Quantum VQE scoring (`quantumScore`, `wukong_vqe.py`)
- citation.manus.space integration (`citation-client.ts`)
- Convergence detection (`convergence.ts`)
- Home page with live stats ticker, 4-track discovery architecture, 8-stage verification pipeline
- Findings, Methodology, Knowledge Graph pages
- `hiv-discovery-loop` Heartbeat job
