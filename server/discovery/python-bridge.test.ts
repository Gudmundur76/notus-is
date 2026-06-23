/**
 * python-bridge.test.ts
 *
 * Unit tests for the Python discovery engine bridge.
 * Mocks child_process.spawn so no real Python subprocess is spawned.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

// ── Mock child_process.spawn before importing the module under test ────────────

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "child_process";
import { query, quantumScore, healthCheck } from "./python-bridge";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build a fake child process that emits stdout data then closes.
 */
function makeFakeChild(stdoutData: string, exitCode = 0) {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (signal?: string) => void;
  };
  child.stdout = stdout;
  child.stderr = stderr;
  child.kill = vi.fn();

  // Emit data asynchronously so the spawn() caller can attach listeners first
  setImmediate(() => {
    stdout.emit("data", Buffer.from(stdoutData));
    child.emit("close", exitCode);
  });

  return child;
}

const spawnMock = vi.mocked(spawn);

beforeEach(() => {
  spawnMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("pythonBridge.query", () => {
  it("parses a valid DiscoveryReport from Python stdout", async () => {
    const payload = {
      query: "HIV protease inhibitor",
      domains: ["molecular"],
      total_records: 120,
      quantum_scores: { mol_001: 0.87 },
      source_breakdown: { pubchem: 60, chembl: 60 },
      top_results: [
        {
          id: "mol_001",
          title: "Lopinavir analogue",
          source: "pubchem",
          abstract: "Strong HIV-1 protease inhibitor.",
          score: 0.91,
          smiles: "CC(C)c1ccc(cc1)C(=O)N",
          pic50: 8.5,
        },
      ],
      backend_used: "python_engine",
    };

    spawnMock.mockReturnValue(makeFakeChild(JSON.stringify(payload)) as ReturnType<typeof spawn>);

    const result = await query({ query: "HIV protease inhibitor", maxResults: 10 });

    expect(result.query).toBe("HIV protease inhibitor");
    expect(result.totalRecords).toBe(120);
    expect(result.topResults).toHaveLength(1);
    expect(result.topResults[0]?.id).toBe("mol_001");
    expect(result.topResults[0]?.pic50).toBe(8.5);
    expect(result.sourceBreakdown.pubchem).toBe(60);
    expect(result.backendUsed).toBe("python_engine");
    expect(result.error).toBeUndefined();
  });

  it("returns empty report with error when Python is not installed (ENOENT)", async () => {
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: (signal?: string) => void;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      setImmediate(() => {
        child.emit("error", Object.assign(new Error("spawn python3 ENOENT"), { code: "ENOENT" }));
      });
      return child as ReturnType<typeof spawn>;
    });

    const result = await query({ query: "test" });

    expect(result.totalRecords).toBe(0);
    expect(result.topResults).toHaveLength(0);
    expect(result.backendUsed).toBe("unavailable");
    expect(result.error).toContain("ENOENT");
  });

  it("strips log lines before JSON and still parses correctly", async () => {
    const payload = {
      query: "saquinavir",
      domains: [],
      total_records: 5,
      quantum_scores: {},
      source_breakdown: {},
      top_results: [],
      backend_used: "python_engine",
    };
    // Simulate Python printing log lines before the JSON
    const raw = `[INFO] Loading adapters...\n[INFO] Query started.\n${JSON.stringify(payload)}`;

    spawnMock.mockReturnValue(makeFakeChild(raw) as ReturnType<typeof spawn>);

    const result = await query({ query: "saquinavir" });

    expect(result.totalRecords).toBe(5);
    expect(result.error).toBeUndefined();
  });
});

describe("pythonBridge.healthCheck", () => {
  it("returns adapter status map from Python stdout", async () => {
    const payload = {
      pubchem: true,
      chembl: true,
      pdb: true,
      uniprot: false,
    };

    spawnMock.mockReturnValue(makeFakeChild(JSON.stringify(payload)) as ReturnType<typeof spawn>);

    const result = await healthCheck();

    expect(result.python_engine).toBe(true);
    expect(result.pubchem).toBe(true);
    expect(result.uniprot).toBe(false);
  });

  it("returns { python_engine: false } when Python engine is unavailable", async () => {
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: (signal?: string) => void;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      setImmediate(() => {
        child.emit("error", Object.assign(new Error("No such file"), { code: "ENOENT" }));
      });
      return child as ReturnType<typeof spawn>;
    });

    const result = await healthCheck();

    expect(result.python_engine).toBe(false);
    expect(Object.keys(result)).toHaveLength(1);
  });
});

describe("pythonBridge.quantumScore", () => {
  it("parses quantum score array from Python stdout", async () => {
    const payload = [
      { smiles: "CC(=O)Oc1ccccc1C(=O)O", score: 0.72, confidence: 0.88, backend: "full_amplitude" },
      { smiles: "c1ccccc1", score: 0.31, confidence: 0.65, backend: "full_amplitude" },
    ];

    spawnMock.mockReturnValue(makeFakeChild(JSON.stringify(payload)) as ReturnType<typeof spawn>);

    const result = await quantumScore(["CC(=O)Oc1ccccc1C(=O)O", "c1ccccc1"]);

    expect(result).toHaveLength(2);
    expect(result[0]?.score).toBe(0.72);
    expect(result[0]?.backend).toBe("full_amplitude");
    expect(result[1]?.confidence).toBe(0.65);
  });
});
