#!/usr/bin/env bash
# =============================================================================
# notus.is — Automated Setup Script
# Usage: ./scripts/setup.sh [--skip-python] [--skip-db] [--skip-diag]
#
# Steps:
#   1. Check Node.js ≥ 20, Python ≥ 3.10, and PostgreSQL client prerequisites
#   2. Install pnpm dependencies
#   3. Install Python dependencies (requirements.txt or core packages)
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

# ── Flags ────────────────────────────────────────────────────────────────────
SKIP_PYTHON=0
SKIP_DB=0
SKIP_DIAG=0
for arg in "$@"; do
  case "$arg" in
    --skip-python) SKIP_PYTHON=1 ;;
    --skip-db)     SKIP_DB=1 ;;
    --skip-diag)   SKIP_DIAG=1 ;;
    --help|-h)
      echo "Usage: ./scripts/setup.sh [--skip-python] [--skip-db] [--skip-diag]"
      exit 0 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║         notus.is — Automated Setup                       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0
WARNINGS=0

# =============================================================================
# Step 1: Prerequisites
# =============================================================================
step "Step 1/6 — Checking prerequisites"

# ── Node.js ≥ 20 ─────────────────────────────────────────────────────────────
if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
  NODE_MAJOR=$(echo "${NODE_VER}" | cut -d. -f1)
  if [[ "${NODE_MAJOR}" -ge 20 ]]; then
    ok "Node.js ${NODE_VER}"
  else
    warn "Node.js ${NODE_VER} found — v20+ recommended. Upgrade: https://nodejs.org"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  err "Node.js not found. Install from https://nodejs.org (v20+)"
  ERRORS=$((ERRORS + 1))
fi

# ── pnpm ─────────────────────────────────────────────────────────────────────
if command -v pnpm &>/dev/null; then
  ok "pnpm $(pnpm --version)"
else
  warn "pnpm not found — installing via npm..."
  npm install -g pnpm
  ok "pnpm installed"
fi

# ── Python ≥ 3.10 ────────────────────────────────────────────────────────────
PYTHON_BIN="${PYTHON_BIN:-python3}"
if command -v "${PYTHON_BIN}" &>/dev/null; then
  PY_VER=$("${PYTHON_BIN}" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  PY_MAJOR=$(echo "${PY_VER}" | cut -d. -f1)
  PY_MINOR=$(echo "${PY_VER}" | cut -d. -f2)
  if [[ "${PY_MAJOR}" -ge 3 && "${PY_MINOR}" -ge 10 ]]; then
    ok "Python ${PY_VER}"
  else
    warn "Python ${PY_VER} found — 3.10+ recommended"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  err "Python 3 not found. Install from https://python.org (3.10+)"
  ERRORS=$((ERRORS + 1))
fi

# ── pip ──────────────────────────────────────────────────────────────────────
if command -v pip3 &>/dev/null || "${PYTHON_BIN}" -m pip --version &>/dev/null 2>&1; then
  ok "pip available"
else
  err "pip not found. Install: sudo apt install python3-pip"
  ERRORS=$((ERRORS + 1))
fi

# ── PostgreSQL client (psql) ─────────────────────────────────────────────────
# The project uses MySQL/TiDB via DATABASE_URL but the user's .env template
# points to PostgreSQL — detect whichever is available.
DB_CLIENT_FOUND=0
if command -v psql &>/dev/null; then
  ok "psql $(psql --version | head -1)"
  DB_CLIENT_FOUND=1
fi
if command -v mysql &>/dev/null; then
  ok "mysql client $(mysql --version | head -1)"
  DB_CLIENT_FOUND=1
fi
if [[ "${DB_CLIENT_FOUND}" -eq 0 ]]; then
  warn "No database client (psql / mysql) found in PATH — connectivity tests will be skipped"
  warn "Install: sudo apt install postgresql-client  OR  sudo apt install mysql-client"
  WARNINGS=$((WARNINGS + 1))
fi

# ── DATABASE_URL pre-check ───────────────────────────────────────────────────
if [[ -f ".env" ]] && grep -qE "^DATABASE_URL=.+://.+/.+" .env 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2-)
  # Mask credentials for display
  DB_DISPLAY=$(echo "${DB_URL}" | sed 's|://[^@]*@|://***@|')
  ok "DATABASE_URL configured: ${DB_DISPLAY}"
else
  warn "DATABASE_URL not set or uses placeholder — will be needed before running the server"
  WARNINGS=$((WARNINGS + 1))
fi

# ── PYTHON_DISCOVERY_PATH check ──────────────────────────────────────────────
if [[ -f ".env" ]]; then
  PY_PATH=$(grep "^PYTHON_DISCOVERY_PATH=" .env 2>/dev/null | cut -d= -f2- || true)
  if [[ -n "${PY_PATH}" && -f "${PY_PATH}" ]]; then
    ok "PYTHON_DISCOVERY_PATH exists: ${PY_PATH}"
  elif [[ -n "${PY_PATH}" ]]; then
    warn "PYTHON_DISCOVERY_PATH set but file not found: ${PY_PATH}"
    warn "Discovery engine will fall back to internal Python bridge"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

if [[ "${ERRORS}" -gt 0 ]]; then
  err "Prerequisites check failed (${ERRORS} hard error(s)). Fix the above and re-run."
  exit 1
fi

# =============================================================================
# Step 2: Install pnpm dependencies
# =============================================================================
step "Step 2/6 — Installing pnpm dependencies"

if pnpm install --frozen-lockfile 2>&1 | tail -5; then
  ok "pnpm dependencies installed"
else
  warn "pnpm install --frozen-lockfile failed — trying without frozen lockfile"
  pnpm install 2>&1 | tail -5
  ok "pnpm dependencies installed (lockfile updated)"
fi

# =============================================================================
# Step 3: Install Python dependencies
# =============================================================================
step "Step 3/6 — Installing Python dependencies"

if [[ "${SKIP_PYTHON}" -eq 1 ]]; then
  warn "Skipping Python install (--skip-python)"
else
  # Determine engine path from env or .env file
  PY_ENGINE_PATH="${PYTHON_ENGINE_PATH:-}"
  if [[ -z "${PY_ENGINE_PATH}" && -f ".env" ]]; then
    RAW_PATH=$(grep "^PYTHON_DISCOVERY_PATH=" .env 2>/dev/null | cut -d= -f2- || true)
    if [[ -n "${RAW_PATH}" ]]; then
      # PYTHON_DISCOVERY_PATH points to main.py — derive the directory
      PY_ENGINE_PATH="$(dirname "${RAW_PATH}")"
    fi
  fi

  if [[ -n "${PY_ENGINE_PATH}" && -f "${PY_ENGINE_PATH}/requirements.txt" ]]; then
    info "Installing from ${PY_ENGINE_PATH}/requirements.txt"
    "${PYTHON_BIN}" -m pip install -r "${PY_ENGINE_PATH}/requirements.txt" --quiet
    ok "Python deps installed from engine repo"
  elif [[ -f "requirements.txt" ]]; then
    info "Installing from project requirements.txt"
    "${PYTHON_BIN}" -m pip install -r requirements.txt --quiet
    ok "Python deps installed from requirements.txt"
  else
    info "No requirements.txt found — installing core packages individually"
    "${PYTHON_BIN}" -m pip install --quiet \
      httpx \
      pyyaml \
      requests \
      biopython \
      pandas \
      numpy \
      scikit-learn \
      chembl-webresource-client \
      pubchempy 2>&1 | tail -3 \
      || warn "Some Python packages may have failed — check output above"

    # pyqpanda3 is optional (Origin Quantum SDK)
    if "${PYTHON_BIN}" -m pip install --quiet pyqpanda3 2>/dev/null; then
      ok "pyqpanda3 installed"
    else
      warn "pyqpanda3 not available via pip — quantum scoring will use CPU fallback"
      warn "Install manually: pip install pyqpanda3  OR  see https://qcloud.originqc.com.cn"
    fi

    # rdkit is optional (cheminformatics)
    if "${PYTHON_BIN}" -m pip install --quiet rdkit 2>/dev/null; then
      ok "rdkit installed"
    else
      warn "rdkit not available via pip — trying rdkit-pypi..."
      "${PYTHON_BIN}" -m pip install --quiet rdkit-pypi 2>/dev/null \
        || warn "rdkit not installed — SMILES filtering will use fallback"
    fi

    ok "Python core packages installed"
  fi

  # Smoke-test key imports
  for pkg in httpx yaml requests numpy pandas sklearn; do
    if "${PYTHON_BIN}" -c "import ${pkg}" 2>/dev/null; then
      ok "  import ${pkg}"
    else
      warn "  import ${pkg} failed — some discovery features may be degraded"
    fi
  done
fi

# =============================================================================
# Step 4 (now runs first): Create .env from template
# =============================================================================
step "Step 4/6 — Environment configuration"

ENV_FILE="${PROJECT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  ok ".env already exists — skipping template creation"
  info "Review .env and ensure all REQUIRED values are filled in"
else
  info "Creating .env at ${ENV_FILE}"
  cat > "${ENV_FILE}" << 'ENVEOF'
# =============================================================================
# notus.is — Environment Variables
# Fill in all REQUIRED values before running: pnpm dev
# Generated by scripts/setup.sh
# =============================================================================

# ── Required ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/notus
APP_URL=http://localhost:3000

# ── Python Discovery Engine ───────────────────────────────────────────────────
PYTHON_DISCOVERY_PATH=/home/ubuntu/asi-evolve-discovery-engine/main.py

# ── Optional — quantum hardware ───────────────────────────────────────────────
ORIGIN_QUANTUM_API_KEY=

# ── Optional — citation verification ─────────────────────────────────────────
CITATION_API_KEY=
CITATION_BASE_URL=https://citation.manus.space

# ── Optional — LLM (ASI-Evolve) ──────────────────────────────────────────────
OPENAI_API_KEY=

# ── Optional — FRED / economic data ──────────────────────────────────────────
FRED_API_KEY=

# ── Manus platform (auto-injected in hosted environment) ─────────────────────
# JWT_SECRET=<64-char random string — run: openssl rand -hex 32>
# VITE_APP_ID=<Manus OAuth application ID>
# OAUTH_SERVER_URL=<Manus OAuth backend URL>
# VITE_OAUTH_PORTAL_URL=<Manus login portal URL>
# BUILT_IN_FORGE_API_URL=<Manus built-in API base URL>
# BUILT_IN_FORGE_API_KEY=<Manus built-in API bearer token>
# VITE_FRONTEND_FORGE_API_KEY=<Manus frontend API bearer token>
# VITE_FRONTEND_FORGE_API_URL=<Manus frontend API URL>
# WUKONG_API_TOKEN=<Origin Quantum Cloud token — https://qcloud.originqc.com.cn>
ENVEOF
  warn ".env created — fill in DATABASE_URL and PYTHON_DISCOVERY_PATH, then re-run or run: pnpm db:push"
fi

# Validate key fields in the final .env
info "Validating .env fields..."
MISSING_FIELDS=()
for field in DATABASE_URL APP_URL PYTHON_DISCOVERY_PATH; do
  if ! grep -qE "^${field}=.+" "${ENV_FILE}" 2>/dev/null; then
    MISSING_FIELDS+=("${field}")
  fi
done
if [[ "${#MISSING_FIELDS[@]}" -gt 0 ]]; then
  for f in "${MISSING_FIELDS[@]}"; do
    warn "  ${f} is empty or missing in .env"
  done
else
  ok "All required .env fields are present"
fi

# =============================================================================
# Step 5: Database setup (runs after .env is guaranteed to exist)
# =============================================================================
step "Step 5/6 — Setting up database"

if [[ "${SKIP_DB}" -eq 1 ]]; then
  warn "Skipping database setup (--skip-db)"
else
  if [[ -f "${ENV_FILE}" ]] && grep -qE "^DATABASE_URL=.+://.+/.+" "${ENV_FILE}" 2>/dev/null; then
    DB_URL=$(grep "^DATABASE_URL=" "${ENV_FILE}" | cut -d= -f2-)
    # Skip if still using placeholder values
    if echo "${DB_URL}" | grep -qE "user:pass|<|>"; then
      warn "DATABASE_URL contains placeholder values — skipping pnpm db:push"
      warn "Update .env with real credentials, then run: pnpm db:push"
    else
      info "Running pnpm db:push (Drizzle generate + migrate)..."
      if pnpm db:push 2>&1 | tail -10; then
        ok "Database schema applied"
      else
        warn "pnpm db:push failed — check DATABASE_URL and database connectivity"
        WARNINGS=$((WARNINGS + 1))
      fi
    fi
  else
    warn "DATABASE_URL not configured — skipping pnpm db:push"
    info "After setting DATABASE_URL in .env, run: pnpm db:push"
  fi
fi

# =============================================================================
# Step 6: Integration diagnostic
# =============================================================================
step "Step 6/6 — Running integration diagnostic"

if [[ "${SKIP_DIAG}" -eq 1 ]]; then
  warn "Skipping integration diagnostic (--skip-diag)"
else
  DIAG_SCRIPT="${PROJECT_DIR}/server/discovery/integration-test.ts"

  if [[ ! -f "${DIAG_SCRIPT}" ]]; then
    warn "Integration diagnostic not found at ${DIAG_SCRIPT} — skipping"
    info "You can run a manual smoke test with: pnpm dev"
  else
    # Only run if DATABASE_URL looks real (not placeholder)
    DB_URL=$(grep "^DATABASE_URL=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)
    if echo "${DB_URL}" | grep -qE "user:pass|<|>|^$"; then
      warn "DATABASE_URL contains placeholder — skipping integration diagnostic"
      info "After configuring .env, run: npx tsx server/discovery/integration-test.ts"
    else
      info "Running integration diagnostic..."
      REPORT_FILE="/tmp/notus-integration-report.json"
      if npx tsx "${DIAG_SCRIPT}" 2>&1 | tee /tmp/notus-diag.log; then
        ok "Integration diagnostic passed"
        [[ -f "${REPORT_FILE}" ]] && info "Report saved to ${REPORT_FILE}"
      else
        warn "Integration diagnostic reported errors"
        warn "Check /tmp/notus-diag.log and /tmp/notus-integration-report.json"
        WARNINGS=$((WARNINGS + 1))
      fi
    fi
  fi

  # Quick TypeScript type-check
  info "Running TypeScript type-check..."
  if npx tsc --noEmit 2>&1 | tail -5; then
    ok "TypeScript: no errors"
  else
    warn "TypeScript errors found — run: npx tsc --noEmit"
    WARNINGS=$((WARNINGS + 1))
  fi

  # Quick test run (non-blocking)
  info "Running Vitest suite..."
  if pnpm test 2>&1 | tail -5; then
    ok "All tests passed"
  else
    warn "Some tests failed — run: pnpm test for details"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
if [[ "${ERRORS}" -gt 0 ]]; then
  echo -e "${BOLD}║  Setup FAILED  (${ERRORS} error(s), ${WARNINGS} warning(s))                  ║${NC}"
elif [[ "${WARNINGS}" -gt 0 ]]; then
  echo -e "${BOLD}║  Setup complete with ${WARNINGS} warning(s)                      ║${NC}"
else
  echo -e "${BOLD}║  Setup complete ✅                                        ║${NC}"
fi
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo -e "  1. Edit ${BOLD}.env${NC} — fill in DATABASE_URL, PYTHON_DISCOVERY_PATH, and optional keys"
echo -e "  2. Run ${BOLD}pnpm db:push${NC} to apply database migrations"
echo -e "  3. Run ${BOLD}pnpm dev${NC} to start the development server"
APP_URL_DISPLAY=$(grep "^APP_URL=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || echo "http://localhost:3000")
echo -e "  4. Open ${BOLD}${APP_URL_DISPLAY}/verification-dashboard${NC} in your browser"
echo -e "  5. Run ${BOLD}npx tsx server/discovery/integration-test.ts${NC} to validate end-to-end"
echo ""
echo -e "  ${CYAN}Useful commands:${NC}"
echo -e "  ${BOLD}pnpm test${NC}                  — run Vitest suite (130 tests)"
echo -e "  ${BOLD}npx tsc --noEmit${NC}           — TypeScript type-check"
echo -e "  ${BOLD}pnpm db:push${NC}               — apply Drizzle migrations"
echo -e "  ${BOLD}./scripts/setup.sh --help${NC}  — show setup flags"
echo ""
