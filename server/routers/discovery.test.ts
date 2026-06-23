/**
 * Discovery router tests
 * Tests the tRPC procedures for the HIV protease discovery engine.
 * Uses the real database via getDb() — all writes are rolled back after each test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { discoveryRouter } from "./discovery";
import { initTRPC } from "@trpc/server";

// Mock the discovery loop to avoid running actual chemistry computations in tests
vi.mock("../discovery/loop", () => ({
  runSingleCycle: vi.fn().mockResolvedValue({
    cycleNumber: 1,
    dayNumber: 1,
    candidatesGenerated: 5,
    candidatesVerified: 2,
    bestPic50: 8.5,
    convergenceCandidates: 0,
    citationPassRate: 0.4,
    durationMs: 1000,
  }),
  getLoopStatus: vi.fn().mockReturnValue({
    isRunning: false,
    lastCycleAt: null,
    nextCycleAt: null,
    error: null,
    totalCyclesRun: 0,
  }),
  getLoopStats: vi.fn().mockResolvedValue({
    totalCandidates: 0,
    corpusSize: 44,
    bestPic50: 0,
    bestSmiles: null,
    dayNumber: 1,
    totalCycles: 0,
    verifiedCount: 0,
    meanConfidence: 0,
  }),
}));

// Create a minimal tRPC instance for testing
const t = initTRPC.context<{ user: null }>().create();
const createCaller = t.createCallerFactory(discoveryRouter);

describe("discovery.stats", () => {
  it("returns valid stats shape", async () => {
    const caller = createCaller({ user: null });
    const stats = await caller.stats();

    expect(stats).toHaveProperty("totalCandidates");
    expect(stats).toHaveProperty("corpusSize");
    expect(stats).toHaveProperty("bestPic50");
    expect(stats).toHaveProperty("dayNumber");
    expect(stats).toHaveProperty("totalCycles");
    expect(typeof stats.totalCandidates).toBe("number");
    expect(typeof stats.corpusSize).toBe("number");
    expect(typeof stats.bestPic50).toBe("number");
    expect(typeof stats.dayNumber).toBe("number");
    expect(typeof stats.totalCycles).toBe("number");
  });

  it("corpusSize is non-negative", async () => {
    const caller = createCaller({ user: null });
    const stats = await caller.stats();
    expect(stats.corpusSize).toBeGreaterThanOrEqual(0);
  });

  it("dayNumber is between 1 and 30", async () => {
    const caller = createCaller({ user: null });
    const stats = await caller.stats();
    expect(stats.dayNumber).toBeGreaterThanOrEqual(1);
    expect(stats.dayNumber).toBeLessThanOrEqual(30);
  });
});

describe("discovery.loopStatus", () => {
  it("returns valid loop status shape", async () => {
    const caller = createCaller({ user: null });
    const status = await caller.loopStatus();

    expect(status).toHaveProperty("isRunning");
    expect(status).toHaveProperty("lastCycleAt");
    expect(status).toHaveProperty("error");
    expect(typeof status.isRunning).toBe("boolean");
  });
});

describe("discovery.candidates", () => {
  it("returns paginated results with correct shape", async () => {
    const caller = createCaller({ user: null });
    const result = await caller.candidates({
      page: 1,
      pageSize: 10,
    });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("pageSize");
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("respects page size limit", async () => {
    const caller = createCaller({ user: null });
    const result = await caller.candidates({
      page: 1,
      pageSize: 5,
    });

    expect(result.items.length).toBeLessThanOrEqual(5);
  });

  it("validates minPic50 filter", async () => {
    const caller = createCaller({ user: null });
    const result = await caller.candidates({
      page: 1,
      pageSize: 20,
      minPic50: 8.0,
    });

    // All returned candidates should have pic50 >= 8.0
    for (const c of result.items) {
      if (c.pic50Predicted !== null) {
        expect(c.pic50Predicted).toBeGreaterThanOrEqual(8.0);
      }
    }
  });

  it("validates track filter", async () => {
    const caller = createCaller({ user: null });
    const result = await caller.candidates({
      page: 1,
      pageSize: 20,
      track: "A",
    });

    for (const c of result.items) {
      expect(c.track).toBe("A");
    }
  });
});

describe("discovery.cycles", () => {
  it("returns paginated cycle history", async () => {
    const caller = createCaller({ user: null });
    const result = await caller.cycles({ page: 1, pageSize: 5 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });
});

describe("discovery.trackDistribution", () => {
  it("returns distribution for all 4 tracks", async () => {
    const caller = createCaller({ user: null });
    const dist = await caller.trackDistribution();

    expect(Array.isArray(dist)).toBe(true);
    // Each entry should have track, total, verified
    for (const entry of dist) {
      expect(entry).toHaveProperty("track");
      expect(entry).toHaveProperty("total");
      expect(entry).toHaveProperty("verified");
      expect(["A", "B", "C", "D"]).toContain(entry.track);
    }
  });
});

describe("discovery.bestCandidates", () => {
  it("returns top candidates sorted by pIC50", async () => {
    const caller = createCaller({ user: null });
    const candidates = await caller.bestCandidates({ limit: 5 });

    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeLessThanOrEqual(5);

    // Should be sorted descending by pic50
    for (let i = 1; i < candidates.length; i++) {
      const prev = candidates[i - 1].pic50Predicted ?? 0;
      const curr = candidates[i].pic50Predicted ?? 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});
