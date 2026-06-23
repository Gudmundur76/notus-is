# notus.is — Deployment Guide

> **Phase-F** | Last updated: 2026-06-23

This guide covers every step required to deploy **notus.is** from a clean machine to a fully operational autonomous drug-discovery platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clone and Install](#step-1-clone-and-install)
3. [Environment Variables](#step-2-environment-variables)
4. [Database Setup](#step-3-database-setup)
5. [Python Environment](#step-4-python-environment)
6. [Quantum Hardware Activation](#step-5-quantum-hardware-activation)
7. [Build and Start](#step-6-build-and-start)
8. [Heartbeat Scheduler](#step-7-heartbeat-scheduler)
9. [Health Check](#step-8-health-check)
10. [Manus Platform Deployment](#step-9-manus-platform-deployment)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20 LTS+ | `node --version` |
| pnpm | 9+ | `npm i -g pnpm` |
| Python | 3.10+ | `python3 --version` |
| pip | 23+ | `pip3 --version` |
| MySQL / TiDB | 8.0+ | Any MySQL-compatible server |

**Optional (for quantum scoring):**

| Requirement | Notes |
|---|---|
| `WUKONG_API_TOKEN` | Origin Quantum Cloud account at [qcloud.originqc.com.cn](https://qcloud.originqc.com.cn) |
| `QUAFU_API_KEY` | BAQIS Quafu account at [quafu.baqis.ac.cn](https://quafu.baqis.ac.cn) |
| pyqpanda3 | `pip3 install pyqpanda3` |

---

## Step 1: Clone and Install

```bash
git clone https://github.com/Gudmundur76/notus-is.git
cd notus-is
pnpm install
```

---

## Step 2: Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string: `mysql://user:pass@host:3306/notus` |
| `JWT_SECRET` | Random 64-char secret for session cookies |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API base URL |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in API bearer token (server-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus built-in API bearer token (client-side) |
| `VITE_FRONTEND_FORGE_API_URL` | Manus built-in API URL (client-side) |
| `WUKONG_API_TOKEN` | Origin Quantum Cloud API token (used by `wukong_vqe.py`) |

### Optional Variables

| Variable | Default | Description |
|---|---|---|
| `WUKONG_BACKEND` | `full_amplitude` | `WK_C180_2` for real hardware, `full_amplitude` for free simulator |
| `QUAFU_API_KEY` | — | Quafu ScQ hardware API key |
| `QUAFU_API_URL` | `https://quafu.baqis.ac.cn/qbackend/scq_u3cx` | Override Quafu endpoint |
| `CITATION_API_KEY` | — | citation.manus.space API key (public endpoints work without it) |
| `PYTHON_BRIDGE_TIMEOUT_MS` | `30000` | Timeout for Python bridge queries |
| `NODE_ENV` | `development` | Set to `production` for deployment |
| `PORT` | auto | Server port (do not hardcode) |

---

## Step 3: Database Setup

Run the Drizzle migrations to create all tables:

```bash
pnpm db:push
```

This creates the following tables:

| Table | Purpose |
|---|---|
| `users` | Manus OAuth user accounts |
| `sessions` | JWT session store |
| `candidates` | Discovered drug candidates |
| `cycles` | Legacy discovery cycle records |
| `loop_state` | ASI-Evolve loop state |
| `evolve_nodes` | ASI-Evolve knowledge graph nodes |
| `evolve_cognition` | Cognition items fed to the Researcher |
| `evolve_runs` | ASI-Evolve run records |
| `verification_cycles` | Unified 6-phase verification cycle records |
| `domain_cycle_summaries` | Per-domain daily aggregate summaries |

To verify the schema was applied:

```bash
pnpm db:push  # idempotent — safe to run again
```

---

## Step 4: Python Environment

The Python bridge (`server/discovery/python-bridge.ts`) spawns `python3` subprocesses to query 50 external data adapters. Install the required packages:

```bash
pip3 install -r requirements.txt
```

If `requirements.txt` is not present, install manually:

```bash
pip3 install \
  requests \
  biopython \
  rdkit-pypi \
  pandas \
  numpy \
  scikit-learn \
  chembl-webresource-client \
  pubchempy \
  pyqpanda3
```

Verify the bridge works:

```bash
python3 server/discovery/adapters/pubchem_adapter.py "HIV protease inhibitor" 3
```

Expected output: JSON array of records.

---

## Step 5: Quantum Hardware Activation

See [QUANTUM.md](./QUANTUM.md) for the full activation guide.

**Quick start (free simulator):**

```bash
# .env
WUKONG_API_TOKEN=your_token_here
WUKONG_BACKEND=full_amplitude   # free, no QPU credits needed
```

**Real hardware (180-qubit WuKong chip):**

```bash
WUKONG_BACKEND=WK_C180_2        # requires QPU credits
```

The quantum scoring module (`server/discovery/predictor.ts`) falls back to classical CPU heuristics automatically if the API is unreachable.

---

## Step 6: Build and Start

### Development

```bash
pnpm dev
```

Starts the Express server with `tsx watch` (hot reload). Vite dev server proxies `/api/*` to the Express backend.

### Production

```bash
pnpm build
node dist/index.js
```

The build compiles:
- Frontend: Vite → `dist/client/`
- Backend: esbuild → `dist/index.js`

---

## Step 7: Heartbeat Scheduler

Three Heartbeat jobs are registered automatically on server startup:

| Job | Cron | UTC fire times | Handler |
|---|---|---|---|
| `hiv-discovery-loop` | `0 0 0/4 * * *` | 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 | `POST /api/scheduled/discovery-loop` |
| `hiv-verification-cycle` | `0 0 2/4 * * *` | 02:00, 06:00, 10:00, 14:00, 18:00, 22:00 | `POST /api/scheduled/verification-cycle` |
| `hiv-domain-scheduler` | `0 0 1/4 * * *` | 01:00, 05:00, 09:00, 13:00, 17:00, 21:00 | `POST /api/scheduled/domain-scheduler` |

The jobs are registered via the Manus Heartbeat API. No external cron daemon is required.

To verify registration after startup, check the server logs for:

```
[Heartbeat] Registered: hiv-discovery-loop
[Heartbeat] Registered: hiv-verification-cycle
[Heartbeat] Registered: hiv-domain-scheduler
```

---

## Step 8: Health Check

Run the integration diagnostic to verify the full pipeline:

```bash
npx tsx server/discovery/integration-test.ts
```

Expected output:

```
╔══════════════════════════════════════════════════════════╗
║         notus.is — Integration Diagnostic (Phase-F)     ║
╚══════════════════════════════════════════════════════════╝

▶ Step 1/5 — Python bridge health check...
  ✅ Python bridge: HEALTHY

▶ Step 2/5 — Querying all 12 domains (maxResults=5 each)...
  Domain         Status     Discovered   Scored   ms
  ──────────────────────────────────────────────────────
  Biomedical     ✅ ok      5            5        312
  Molecular      ✅ ok      5            5        287
  ...

▶ Step 3/5 — Citation verification (top-3 candidates)...
  🔶 Status: DRY_RUN
  Candidates submitted: 3

▶ Step 4/5 — Cognition items in evolve_cognition table...
  ✅ Items in DB: 42

▶ Step 5/5 — Verification cycle state...
  ✅ Status: OK
  Total cycles: 3 | Completed: 3

╔══════════════════════════════════════════════════════════╗
║  Overall: ✅ PASS                                        ║
║  Elapsed: 4821ms                                         ║
╚══════════════════════════════════════════════════════════╝

  📄 Full report saved to: /tmp/integration-report.json
```

The JSON report at `/tmp/integration-report.json` contains full timing and record counts for each step.

---

## Step 9: Manus Platform Deployment

notus.is is hosted on the Manus platform with **Autoscale** (serverless) mode.

1. Ensure all changes are committed and a checkpoint has been saved.
2. Click the **Publish** button in the Manus Management UI.
3. The platform builds and deploys automatically.

**Custom domain:** Configure in Management UI → Settings → Domains.

**Environment variables:** Manage in Management UI → Settings → Secrets. All variables listed in [Step 2](#step-2-environment-variables) must be set before publishing.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `python3: command not found` | Python not installed | `sudo apt install python3 python3-pip` |
| `ModuleNotFoundError: rdkit` | RDKit not installed | `pip3 install rdkit-pypi` |
| `[Quantum] wukong_vqe parse error` | pyqpanda3 not installed | `pip3 install pyqpanda3` |
| `[Heartbeat] Registration failed` | Server not yet started | Wait for server to be ready, then restart |
| `DATABASE_URL not set` | Missing env var | Add to `.env` and restart |
| Cycles stuck at `running` | Server crash during cycle | Run `UPDATE verification_cycles SET status='failed' WHERE status='running'` |
