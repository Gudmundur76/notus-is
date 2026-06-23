/**
 * python-bridge.ts
 *
 * Bridge between notus.is (TypeScript) and the parallel Python discovery engine.
 * Uses the same spawn() pattern as wukong_vqe.py in predictor.ts.
 *
 * The Python engine CLI contract:
 *   python3 <ENGINE_PATH>/main.py "<query>" --format json --max-results <N> [--no-quantum] [--domains <d1,d2>]
 *
 * Expected JSON stdout:
 *   {
 *     "query": "...",
 *     "domains": ["molecular"],
 *     "total_records": 150,
 *     "quantum_scores": { "id1": 0.85 },
 *     "source_breakdown": { "pubchem": 50, "chembl": 40 },
 *     "top_results": [{ "id": "...", "title": "...", "source": "...", "abstract": "..." }]
 *   }
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DiscoveryResult {
  id: string;
  title: string;
  source: string;
  abstract: string;
  score?: number;
  smiles?: string;
  pic50?: number;
  metadata?: Record<string, unknown>;
}

export interface DiscoveryReport {
  query: string;
  domains: string[];
  totalRecords: number;
  quantumScores: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  topResults: DiscoveryResult[];
  backendUsed: string;
  elapsedMs: number;
  error?: string;
}

export interface QuantumScoreResult {
  smiles: string;
  score: number;
  confidence: number;
  backend: string;
}

export interface QueryOptions {
  query: string;
  domains?: string[];
  useQuantum?: boolean;
  maxResults?: number;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const ENGINE_PATH =
  process.env.PYTHON_ENGINE_PATH ??
  path.resolve(__dirname, "../../asi-evolve-discovery-engine");

const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
const QUERY_TIMEOUT_MS = 30_000; // 30 seconds per query

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Spawn a Python subprocess and collect its stdout as a string.
 * Resolves with the raw stdout string; rejects on timeout or spawn error.
 */
function spawnPython(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(PYTHON_BIN, args, {
      env: { ...process.env },
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGTERM");
        reject(new Error(`Python subprocess timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code !== 0 && !stdout.trim()) {
        reject(
          new Error(
            `Python subprocess exited with code ${code}. stderr: ${stderr.slice(0, 300)}`
          )
        );
      } else {
        resolve(stdout.trim());
      }
    });

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

/**
 * Check whether the Python engine is available at ENGINE_PATH.
 */
async function isPythonEngineAvailable(): Promise<boolean> {
  try {
    await spawnPython(
      ["-c", `import sys; sys.path.insert(0,'${ENGINE_PATH}'); print('ok')`],
      5_000
    );
    return true;
  } catch {
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run a discovery query against the Python engine.
 * Returns an empty DiscoveryReport (with error field) if Python is unavailable.
 */
export async function query(options: QueryOptions): Promise<DiscoveryReport> {
  const { query: q, domains, useQuantum = true, maxResults = 50 } = options;
  const t0 = Date.now();

  const mainScript = path.join(ENGINE_PATH, "main.py");
  const args: string[] = [
    mainScript,
    q,
    "--format", "json",
    "--max-results", String(maxResults),
  ];
  if (!useQuantum) args.push("--no-quantum");
  if (domains && domains.length > 0) args.push("--domains", domains.join(","));

  try {
    const raw = await spawnPython(args, QUERY_TIMEOUT_MS);

    // The Python engine may emit log lines before the JSON — find the JSON object
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`No JSON object found in Python output: ${raw.slice(0, 200)}`);
    }
    const jsonStr = raw.slice(jsonStart, jsonEnd + 1);

    const parsed = JSON.parse(jsonStr) as {
      query?: string;
      domains?: string[];
      total_records?: number;
      quantum_scores?: Record<string, number>;
      source_breakdown?: Record<string, number>;
      top_results?: Array<{
        id?: string;
        title?: string;
        source?: string;
        abstract?: string;
        score?: number;
        smiles?: string;
        pic50?: number;
        metadata?: Record<string, unknown>;
      }>;
      backend_used?: string;
      error?: string;
    };

    return {
      query: parsed.query ?? q,
      domains: parsed.domains ?? domains ?? [],
      totalRecords: parsed.total_records ?? 0,
      quantumScores: parsed.quantum_scores ?? {},
      sourceBreakdown: parsed.source_breakdown ?? {},
      topResults: (parsed.top_results ?? []).map((r) => ({
        id: r.id ?? "",
        title: r.title ?? "",
        source: r.source ?? "",
        abstract: r.abstract ?? "",
        score: r.score,
        smiles: r.smiles,
        pic50: r.pic50,
        metadata: r.metadata,
      })),
      backendUsed: parsed.backend_used ?? "python_engine",
      elapsedMs: Date.now() - t0,
      error: parsed.error,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isPythonMissing =
      msg.includes("ENOENT") ||
      msg.includes("No such file") ||
      msg.includes("not found");

    if (isPythonMissing) {
      console.warn("[PythonBridge] Python engine not available:", msg);
    } else {
      console.warn("[PythonBridge] Query failed:", msg);
    }

    return {
      query: q,
      domains: domains ?? [],
      totalRecords: 0,
      quantumScores: {},
      sourceBreakdown: {},
      topResults: [],
      backendUsed: "unavailable",
      elapsedMs: Date.now() - t0,
      error: msg,
    };
  }
}

/**
 * Batch quantum scoring via the Python engine's VQE pipeline.
 * Falls back to empty array with error if Python is unavailable.
 */
export async function quantumScore(
  smilesList: string[]
): Promise<QuantumScoreResult[]> {
  if (smilesList.length === 0) return [];

  const mainScript = path.join(ENGINE_PATH, "main.py");
  const args = [
    mainScript,
    "--quantum-score",
    "--smiles",
    smilesList.join(","),
    "--format",
    "json",
  ];

  try {
    const raw = await spawnPython(args, QUERY_TIMEOUT_MS);
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`No JSON array in Python output: ${raw.slice(0, 200)}`);
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Array<{
      smiles?: string;
      score?: number;
      confidence?: number;
      backend?: string;
    }>;

    return parsed.map((r, i) => ({
      smiles: r.smiles ?? smilesList[i] ?? "",
      score: r.score ?? 0,
      confidence: r.confidence ?? 0,
      backend: r.backend ?? "python_engine",
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[PythonBridge] quantumScore failed:", msg);
    // Return zero-score entries so callers don't need to handle missing items
    return smilesList.map((smiles) => ({
      smiles,
      score: 0,
      confidence: 0,
      backend: "unavailable",
    }));
  }
}

/**
 * Health check — returns adapter availability map from the Python engine.
 * Returns { python_engine: false } if Python is unavailable.
 */
export async function healthCheck(): Promise<Record<string, boolean>> {
  const mainScript = path.join(ENGINE_PATH, "main.py");
  const args = [mainScript, "--health", "--format", "json"];

  try {
    const raw = await spawnPython(args, 10_000);
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`No JSON in health check output: ${raw.slice(0, 200)}`);
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<
      string,
      boolean
    >;
    return { python_engine: true, ...parsed };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[PythonBridge] healthCheck failed:", msg);
    return { python_engine: false };
  }
}

/**
 * Exported singleton-style object for use in tRPC procedures.
 */
export const pythonBridge = {
  query,
  quantumScore,
  healthCheck,
  isPythonEngineAvailable,
};
