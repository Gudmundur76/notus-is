#!/usr/bin/env bash
# =============================================================================
# notus.is — Automated Setup Script
# Usage: ./scripts/setup.sh
#
# Steps:
#   1. Check Node.js, Python, and database prerequisites
#   2. Install pnpm dependencies
#   3. Install Python dependencies (Option A or B)
#   4. Set up database (pnpm db:push)
#   5. Create .env from template if not present
#   6. Run integration diagnostic
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}  ✅ $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $*${NC}"; }
err()  { echo -e "${RED}  ❌ $*${NC}"; }
info() { echo -e "${CYAN}  ℹ  $*${NC}"; }
step() { echo -e "\n${BOLD}▶ $*${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║         notus.is — Automated Setup (Phase-F)             ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0

# =============================================================================
# Step 1: Prerequisites
# =============================================================================
step "Step 1/6 — Checking prerequisites"

# Node.js ≥ 20
if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
  NODE_MAJOR=$(echo "${NODE_VER}" | cut -d. -f1)
  if [[ "${NODE_MAJOR}" -ge 20 ]]; then
    ok "Node.js ${NODE_VER}"
  else
    warn "Node.js ${NODE_VER} found — v20+ recommended. Upgrade: https://nodejs.org"
  fi
else
  err "Node.js not found. Install from https://nodejs.org (v20+)"
  ERRORS=$((ERRORS + 1))
fi

# pnpm
if command -v pnpm &>/dev/null; then
  ok "pnpm $(pnpm --version)"
else
  warn "pnpm not found — installing via npm..."
  npm install -g pnpm
  ok "pnpm installed"
fi

# Python ≥ 3.10
PYTHON_BIN="${PYTHON_BIN:-python3}"
if command -v "${PYTHON_BIN}" &>/dev/null; then
  PY_VER=$("${PYTHON_BIN}" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  PY_MAJOR=$(echo "${PY_VER}" | cut -d. -f1)
  PY_MINOR=$(echo "${PY_VER}" | cut -d. -f2)
  if [[ "${PY_MAJOR}" -ge 3 && "${PY_MINOR}" -ge 10 ]]; then
    ok "Python ${PY_VER}"
  else
    warn "Python ${PY_VER} found — 3.10+ recommended"
  fi
else
  err "Python 3 not found. Install from https://python.org (3.10+)"
  ERRORS=$((ERRORS + 1))
fi

# pip3
if command -v pip3 &>/dev/null || "${PYTHON_BIN}" -m pip --version &>/dev/null 2>&1; then
  ok "pip available"
else
  err "pip not found. Install: sudo apt install python3-pip"
  ERRORS=$((ERRORS + 1))
fi

# DATABASE_URL check (soft — .env may not exist yet)
if [[ -f ".env" ]] && grep -q "^DATABASE_URL=" .env 2>/dev/null; then
  ok "DATABASE_URL found in .env"
else
  warn "DATABASE_URL not set — will be needed before running the server"
fi

if [[ "${ERRORS}" -gt 0 ]]; then
  err "Prerequisites check failed (${ERRORS} error(s)). Fix the above and re-run."
  exit 1
fi

# =============================================================================
# Step 2: Install pnpm dependencies
# =============================================================================
step "Step 2/6 — Installing pnpm dependencies"
pnpm install --frozen-lockfile 2>&1 | tail -5
ok "pnpm dependencies installed"

# =============================================================================
# Step 3: Install Python dependencies
# =============================================================================
step "Step 3/6 — Installing Python dependencies"

PYTHON_ENGINE_PATH="${PYTHON_ENGINE_PATH:-}"

if [[ -n "${PYTHON_ENGINE_PATH}" && -f "${PYTHON_ENGINE_PATH}/requirements.txt" ]]; then
  info "Option A: using engine repo at ${PYTHON_ENGINE_PATH}"
  "${PYTHON_BIN}" -m pip install -r "${PYTHON_ENGINE_PATH}/requirements.txt" --quiet
  ok "Python deps installed from ${PYTHON_ENGINE_PATH}/requirements.txt"
elif [[ -f "requirements.txt" ]]; then
  info "Option A: using local requirements.txt"
  "${PYTHON_BIN}" -m pip install -r requirements.txt --quiet
  ok "Python deps installed from requirements.txt"
else
  info "Option B: installing core packages individually"
  "${PYTHON_BIN}" -m pip install --quiet \
    pyqpanda3 \
    httpx \
    pyyaml \
    requests \
    biopython \
    rdkit-pypi \
    pandas \
    numpy \
    scikit-learn \
    chembl-webresource-client \
    pubchempy 2>&1 | tail -3 || warn "Some Python packages may have failed — check output above"
  ok "Python core packages installed"
fi

# Verify pyqpanda3
if "${PYTHON_BIN}" -c "import pyqpanda3" 2>/dev/null; then
  ok "pyqpanda3 importable"
else
  warn "pyqpanda3 not importable — quantum scoring will use CPU fallback"
fi

# =============================================================================
# Step 4: Database setup
# =============================================================================
step "Step 4/6 — Setting up database"

if [[ -f ".env" ]] && grep -q "^DATABASE_URL=" .env 2>/dev/null; then
  info "Running pnpm db:push..."
  pnpm db:push 2>&1 | tail -10
  ok "Database migrations applied"
else
  warn "DATABASE_URL not set — skipping pnpm db:push. Set it in .env and run: pnpm db:push"
fi

# =============================================================================
# Step 5: Create .env from template
# =============================================================================
step "Step 5/6 — Environment configuration"

ENV_TEMPLATE="${PROJECT_DIR}/.env.template"
ENV_FILE="${PROJECT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  ok ".env already exists — skipping template creation"
else
  info "Creating .env template at ${ENV_FILE}"
  cat > "${ENV_FILE}" << 'ENVEOF'
# =============================================================================
# notus.is — Environment Variables
# Fill in all REQUIRED values before running pnpm dev or pnpm start
# =============================================================================

# ── Required ─────────────────────────────────────────────────────────────────
DATABASE_URL=mysql://user:pass@host:3306/notus
JWT_SECRET=<64-char random string — run: openssl rand -hex 32>
VITE_APP_ID=<Manus OAuth application ID>
OAUTH_SERVER_URL=<Manus OAuth backend URL>
VITE_OAUTH_PORTAL_URL=<Manus login portal URL>
BUILT_IN_FORGE_API_URL=<Manus built-in API base URL>
BUILT_IN_FORGE_API_KEY=<Manus built-in API bearer token>
VITE_FRONTEND_FORGE_API_KEY=<Manus frontend API bearer token>
VITE_FRONTEND_FORGE_API_URL=<Manus frontend API URL>
WUKONG_API_TOKEN=<Origin Quantum Cloud token — https://qcloud.originqc.com.cn>

# ── Optional ─────────────────────────────────────────────────────────────────
# PYTHON_ENGINE_PATH=/absolute/path/to/asi-evolve-discovery-engine
# PYTHON_BIN=python3
# WUKONG_BACKEND=full_amplitude       # or WK_C180_2 for real QPU
# CITATION_API_KEY=<citation.manus.space key>
# QUAFU_API_KEY=<BAQIS Quafu key>
# PYTHON_BRIDGE_TIMEOUT_MS=30000
# NODE_ENV=production
ENVEOF
  warn ".env created from template — fill in all REQUIRED values before starting the server"
fi

# =============================================================================
# Step 6: Integration diagnostic
# =============================================================================
step "Step 6/6 — Running integration diagnostic"

if [[ -f ".env" ]] && grep -q "^DATABASE_URL=mysql://" .env 2>/dev/null && \
   ! grep -q "^DATABASE_URL=mysql://user:pass" .env 2>/dev/null; then
  info "Running: npx tsx server/discovery/integration-test.ts"
  npx tsx server/discovery/integration-test.ts 2>&1 || warn "Integration diagnostic reported errors — check /tmp/integration-report.json"
else
  warn "Skipping integration diagnostic — DATABASE_URL not configured yet"
  info "After configuring .env, run manually: npx tsx server/discovery/integration-test.ts"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  Setup complete                                           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo -e "  1. Edit ${BOLD}.env${NC} and fill in all REQUIRED values"
echo -e "  2. Run ${BOLD}pnpm db:push${NC} to apply migrations"
echo -e "  3. Run ${BOLD}pnpm dev${NC} to start the development server"
echo -e "  4. Open ${BOLD}http://localhost:3000/verification-dashboard${NC}"
echo -e "  5. Run ${BOLD}npx tsx server/discovery/integration-test.ts${NC} to validate"
echo ""
