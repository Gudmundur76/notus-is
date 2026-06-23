/**
 * Discovery Router — tRPC procedures for the HIV protease discovery engine
 *
 * Exposes:
 *   discovery.stats        — Live loop statistics (public)
 *   discovery.candidates   — Paginated candidate list with filters (public)
 *   discovery.corpus       — Corpus records (public)
 *   discovery.cycles       — Cycle history (public)
 *   discovery.dailyLogs    — Daily summary logs (public)
 *   discovery.convergence  — Convergence candidates (public)
 *   discovery.triggerCycle — Manually trigger a cycle (protected, owner only)
 *   discovery.loopStatus   — Current loop status (public)
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { ALL_DOMAIN_CONFIGS } from "../discovery/domain-configs";
import { DOMAIN_IDS } from "../../shared/types/domain.js";
import type { DomainId } from "../../shared/types/domain.js";
import {
  runSingleDomain,
  getTodayDomainSummaries,
} from "../discovery/asi-evolve/domain-orchestrator";
import { domainCycleSummaries } from "../../drizzle/schema";
import {
  candidates as candidatesTable,
  corpus as corpusTable,
  cycles as cyclesTable,
  dailyLogs,
  cognitionStore,
  citationRegistry,
} from "../../drizzle/schema";
import { eq, desc, asc, and, gte, lte, count, like, or } from "drizzle-orm";
import { getLoopStats, getLoopStatus, runSingleCycle } from "../discovery/loop";
import {
  runVerificationCycle,
  getVerificationCycles,
  getLatestVerificationCycle,
  getVerificationCycleStatus,
  getVerificationCycleHistory,
  getVerificationStats,
  type VerificationCycleStatus,
  type VerificationStats,
} from "../discovery/verification-cycle";
import { pythonBridge } from "../discovery/python-bridge";
import { getEvolveStatus, runEvolveStep } from "../discovery/asi-evolve/orchestrator";
import { getAllNodes, getBestNode, getOrCreateRun } from "../discovery/asi-evolve/database";
import {
  verifyClaim,
  searchClaims,
  listClaimsByVertical,
  buildCandidateClaim,
} from "../discovery/asi-evolve/citation-client";
import {
  verifyCandidates,
  buildCandidateClaims,
  createRealCitationClient,
} from "../discovery/candidate-claim";
import { evolveDiscoveryQuery } from "../discovery/query-evolver";
import { generateReport, renderReportMarkdown } from "../discovery/report-generator";
import { TRPCError } from "@trpc/server";

export const discoveryRouter = router({
  // ── Stats ────────────────────────────────────────────────────────────────────
  stats: publicProcedure.query(async () => {
    return await getLoopStats();
  }),

  loopStatus: publicProcedure.query(() => {
    return getLoopStatus();
  }),

  // ── Candidates ───────────────────────────────────────────────────────────────
  candidates: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        track: z.enum(["A", "B", "C", "D"]).optional(),
        minPic50: z.number().optional(),
        maxPic50: z.number().optional(),
        citationGatePassed: z.boolean().optional(),
        isDruglike: z.boolean().optional(),
        searchSmiles: z.string().optional(),
        sortBy: z.enum(["pic50", "confidence", "createdAt"]).default("pic50"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };

      const conditions = [];
      if (input.track) conditions.push(eq(candidatesTable.track, input.track));
      if (input.minPic50 !== undefined)
        conditions.push(gte(candidatesTable.pic50Predicted, input.minPic50));
      if (input.maxPic50 !== undefined)
        conditions.push(lte(candidatesTable.pic50Predicted, input.maxPic50));
      if (input.citationGatePassed !== undefined)
        conditions.push(eq(candidatesTable.citationGatePassed, input.citationGatePassed));
      if (input.isDruglike !== undefined)
        conditions.push(eq(candidatesTable.isDruglike, input.isDruglike));
      if (input.searchSmiles)
        conditions.push(like(candidatesTable.smiles, `%${input.searchSmiles}%`));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const orderCol =
        input.sortBy === "pic50"
          ? candidatesTable.pic50Predicted
          : input.sortBy === "confidence"
          ? candidatesTable.confidenceScore
          : candidatesTable.createdAt;

      const orderFn = input.sortDir === "asc" ? asc : desc;

      const [items, totalResult] = await Promise.all([
        db
          .select()
          .from(candidatesTable)
          .where(where)
          .orderBy(orderFn(orderCol))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ count: count() }).from(candidatesTable).where(where),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // ── Single candidate ─────────────────────────────────────────────────────────
  candidate: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [candidate] = await db
        .select()
        .from(candidatesTable)
        .where(eq(candidatesTable.id, input.id))
        .limit(1);

      if (!candidate) return null;

      // Get citation registry entries
      const citations = await db
        .select()
        .from(citationRegistry)
        .where(eq(citationRegistry.candidateId, input.id));

      return { ...candidate, citations };
    }),

  // ── Corpus ───────────────────────────────────────────────────────────────────
  corpus: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        source: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const where = input.source ? eq(corpusTable.source, input.source) : undefined;

      const [items, totalResult] = await Promise.all([
        db
          .select()
          .from(corpusTable)
          .where(where)
          .orderBy(desc(corpusTable.pIC50))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ count: count() }).from(corpusTable).where(where),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  // ── Cycles ───────────────────────────────────────────────────────────────────
  cycles: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const [items, totalResult] = await Promise.all([
        db
          .select()
          .from(cyclesTable)
          .orderBy(desc(cyclesTable.cycleNumber))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ count: count() }).from(cyclesTable),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  // ── Daily logs ───────────────────────────────────────────────────────────────
  dailyLogs: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(dailyLogs).orderBy(asc(dailyLogs.dayNumber));
  }),

  // ── Convergence candidates ───────────────────────────────────────────────────
  convergence: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { candidates: [], bestPic50: 0 };

    // Get candidates that appear in multiple tracks (convergence candidates)
    // These are candidates with the highest pIC50 that passed citation gate
    const topCandidates = await db
      .select()
      .from(candidatesTable)
      .where(
        and(
          eq(candidatesTable.citationGatePassed, true),
          gte(candidatesTable.pic50Predicted, 8.0)
        )
      )
      .orderBy(desc(candidatesTable.pic50Predicted))
      .limit(20);

    const bestPic50 = topCandidates[0]?.pic50Predicted ?? 0;

    return { candidates: topCandidates, bestPic50 };
  }),

  // ── Cognition store ──────────────────────────────────────────────────────────
  cognition: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const [record] = await db
      .select()
      .from(cognitionStore)
      .where(eq(cognitionStore.targetChemblId, "CHEMBL247"))
      .limit(1);

    return record ?? null;
  }),

  // ── Best candidates (top 10 by pIC50) ───────────────────────────────────────
  bestCandidates: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(candidatesTable)
        .where(eq(candidatesTable.citationGatePassed, true))
        .orderBy(desc(candidatesTable.pic50Predicted))
        .limit(input.limit);
    }),

  // ── Trigger cycle (owner only) ───────────────────────────────────────────────
  triggerCycle: protectedProcedure.mutation(async ({ ctx }) => {
    // Only the project owner can manually trigger a cycle
    const ownerOpenId = process.env.OWNER_OPEN_ID;
    if (ownerOpenId && ctx.user.openId !== ownerOpenId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the project owner can trigger discovery cycles",
      });
    }

    // Run cycle in background (don't await — return immediately)
    runSingleCycle().catch(err => {
      console.error("[Discovery] Manual cycle trigger failed:", err);
    });

    return { triggered: true, message: "Discovery cycle started" };
  }),

  // ── ASI-Evolve status ────────────────────────────────────────────────────────
  evolveStatus: publicProcedure.query(async () => {
    return getEvolveStatus();
  }),

  // ── ASI-Evolve recent steps ──────────────────────────────────────────────────
  evolveNodes: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      try {
        const runId = await getOrCreateRun();
        const all = await getAllNodes(runId);
        return all.slice(-input.limit).reverse();
      } catch {
        return [];
      }
    }),

  // ── ASI-Evolve best node ─────────────────────────────────────────────────────
  evolveBest: publicProcedure.query(async () => {
    try {
      const runId = await getOrCreateRun();
      return getBestNode(runId);
    } catch {
      return null;
    }
  }),

  // ── Trigger ASI-Evolve step (owner only) ─────────────────────────────────────
  triggerEvolveStep: protectedProcedure.mutation(async ({ ctx }) => {
    const ownerOpenId = process.env.OWNER_OPEN_ID;
    if (ownerOpenId && ctx.user.openId !== ownerOpenId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the project owner can trigger evolve steps",
      });
    }
    runEvolveStep().catch(err => {
      console.error("[ASI-Evolve] Manual step trigger failed:", err);
    });
    return { triggered: true, message: "ASI-Evolve step started" };
  }),

  // ── citation.manus.space: verify a single claim ──────────────────────────────
  citationVerifyClaim: publicProcedure
    .input(z.object({
      claim: z.string().min(10).max(2000),
      vertical: z.string().default("structural_biology"),
    }))
    .mutation(async ({ input }) => {
      const result = await verifyClaim(input.claim, input.vertical);
      return result ?? { verdict: "Insufficient Evidence" as const, confidenceScore: 0, evidenceSource: "", summary: "" };
    }),

  // ── citation.manus.space: search verified claims corpus ──────────────────────
  citationSearchClaims: publicProcedure
    .input(z.object({
      q: z.string().min(2).max(200),
      limit: z.number().int().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      return searchClaims(input.q, { limit: input.limit, vertical: "structural_biology" });
    }),

  // ── citation.manus.space: latest verified claims for HIV protease ─────────────
  citationLatestClaims: publicProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return listClaimsByVertical("structural_biology", {
        page: input.page,
        pageSize: input.pageSize,
        verdict: "Supported",
      });
    }),

  // ── citation.manus.space: build and verify a candidate claim ─────────────────
  citationVerifyCandidate: publicProcedure
    .input(z.object({
      smiles: z.string().min(1).max(500),
      pic50: z.number(),
      name: z.string().optional(),
      track: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const claimText = buildCandidateClaim({
        name: input.name ?? input.smiles.slice(0, 30),
        smiles: input.smiles,
        pic50: input.pic50,
        track: input.track ?? "unknown",
        verificationSource: "HIV-1 protease (UniProt P04585)",
      });
      const result = await verifyClaim(claimText, "structural_biology");
      return {
        claimText,
        verdict: result?.verdict ?? "Insufficient Evidence",
        confidenceScore: result?.confidenceScore ?? 0,
        evidenceSource: result?.evidenceSource ?? "",
        summary: result?.summary ?? "",
        citationUrl: result ? "https://citation.manus.space" : null,
      };
    }),


  // ── Python discovery engine bridge ──────────────────────────────────────────
  /**
   * Run a query against the parallel Python discovery engine (60 data sources).
   * Returns an empty report with error field if the Python engine is not installed.
   */
  queryPython: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        domains: z.array(z.string()).optional(),
        useQuantum: z.boolean().default(true),
        maxResults: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      return pythonBridge.query({
        query: input.query,
        domains: input.domains,
        useQuantum: input.useQuantum,
        maxResults: input.maxResults,
      });
    }),

  /**
   * Health check — returns adapter availability map from the Python engine.
   * Returns { python_engine: false } if the engine is not installed.
   */
  pythonHealth: publicProcedure.query(async () => {
    return pythonBridge.healthCheck();
  }),

  /**
   * Batch quantum scoring via the Python engine's VQE pipeline.
   * Falls back to zero-score entries if the engine is unavailable.
   */
  pythonQuantumScore: publicProcedure
    .input(
      z.object({
        smiles: z.array(z.string().min(1).max(500)).min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      return pythonBridge.quantumScore(input.smiles);
    }),

  // ── Source registry ────────────────────────────────────────────────────────
  sourceRegistry: publicProcedure
    .input(z.object({ domain: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const { getAllSources, getSourcesByDomain } = await import("../discovery/python-adapter");
      const sources = input?.domain
        ? getSourcesByDomain(input.domain)
        : getAllSources();
      return {
        total: sources.length,
        sources: sources.map(s => ({
          id: s.id,
          name: s.name,
          domain: s.domain,
          adapterType: s.adapterType,
          isQuantumEligible: s.isQuantumEligible,
          isNative: s.isNative,
          sourceUrl: s.sourceUrl,
        })),
      };
    }),

  // ── Python adapter status ────────────────────────────────────────────────────
  pythonAdapterStatus: publicProcedure.query(async () => {
    const { getAllSources, getPythonOnlySources } = await import("../discovery/python-adapter");
    const all = getAllSources();
    const pythonOnly = getPythonOnlySources();
    const health = await pythonBridge.healthCheck();
    return {
      totalSources: all.length,
      pythonSources: pythonOnly.length,
      tsSources: all.length - pythonOnly.length,
      pythonEngineAvailable: Object.values(health).some(Boolean),
      adapterHealth: health,
    };
  }),

  // ── Verification Cycles ─────────────────────────────────────────────────────

  /**
   * Paginated list of all verification cycles.
   * Each cycle captures all 6 phases with timing, item counts, and results.
   */
  verificationCycles: publicProcedure
    .input(
      z.object({
        page:     z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      return await getVerificationCycles(input.page, input.pageSize);
    }),

  /**
   * Fetch the most recent verification cycle (or null if none have run yet).
   */
  latestVerificationCycle: publicProcedure.query(async () => {
    return await getLatestVerificationCycle();
  }),

  /**
   * Status of the current (or most recent) verification cycle.
   * Returns status="idle" when no cycles have ever run.
   */
  verificationCycleStatus: publicProcedure.query(async (): Promise<VerificationCycleStatus> => {
    return await getVerificationCycleStatus();
  }),

  /**
   * Paginated history of all verification cycles, newest first.
   * Supports up to 100 items per page.
   */
  verificationCycleHistory: publicProcedure
    .input(
      z.object({
        page:     z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      return await getVerificationCycleHistory(input.page, input.pageSize);
    }),

  /**
   * Aggregate statistics across all verification cycles:
   *   - total / completed / failed / running counts
   *   - total claims verified, support rate, best pIC50, avg duration
   *   - convergence flag, last cycle timestamp
   */
  verificationStats: publicProcedure.query(async (): Promise<VerificationStats> => {
    return await getVerificationStats();
  }),

  /**
   * Manually trigger a unified 6-phase verification cycle.
   * Protected: owner only. Responds immediately; cycle runs in background.
   */
  triggerVerificationCycle: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Owner only" });
    }

    // Fire-and-forget: cycle persists its own state to DB
    runVerificationCycle().then(result => {
      console.log(
        `[tRPC] Manual verification cycle ${result.cycleId} ${result.status}: ` +
        `discovered=${result.candidatesDiscovered}, scored=${result.candidatesScored}, ` +
        `verified=${result.claimsVerified}, evolve=${result.evolveStepName ?? "none"}, ` +
        `convergence=${result.convergenceReached}, duration=${result.durationMs}ms`
      );
    }).catch(err => {
      console.error("[tRPC] Verification cycle error:", err);
    });

    return {
      status: "accepted",
      message: "Verification cycle started. Poll latestVerificationCycle for progress.",
      timestamp: new Date().toISOString(),
    };
  }),

  // ── Verified Candidates ─────────────────────────────────────────────────────
  /**
   * Retrieve candidates from the DB and run them through the full
   * CandidateClaim / verifyCandidates() pipeline on-demand.
   *
   * Accepts an optional `limit` (default 10, max 50) to cap the number of
   * candidates submitted to citation.manus.space in a single call.
   */
  verifiedCandidates: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
        track: z.enum(["A", "B", "C", "D"]).optional(),
        minPic50: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { candidates: [], total: 0 };

      // Build filter conditions
      const conditions = [];
      if (input.track) {
        conditions.push(eq(candidatesTable.track, input.track));
      }
      if (input.minPic50 != null) {
        conditions.push(gte(candidatesTable.pic50Predicted, input.minPic50));
      }

      const rows = await db
        .select()
        .from(candidatesTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(candidatesTable.pic50Predicted))
        .limit(input.limit);

      if (rows.length === 0) return { candidates: [], total: 0 };

      // Run through the verifyCandidates() layer
      const client = await createRealCitationClient();
      const verified = await verifyCandidates(rows, client, {
        vertical: "structural_biology",
        queryHint: "HIV protease inhibitor small molecule binding affinity pIC50",
      });

      return {
        candidates: verified.map((vc) => ({
          candidateId: vc.claim.candidateId,
          smiles: vc.claim.smiles,
          compoundName: vc.claim.compoundName,
          pic50: vc.claim.pic50,
          source: vc.claim.source,
          track: vc.candidate.track,
          citationVerdict: vc.citationVerdict,
          citationConfidence: vc.citationConfidence,
          citationDocId: vc.citationDocId,
          citationEvidence: vc.citationEvidence,
          citationGatePassed: vc.citationGatePassed,
          scoreModifier: vc.scoreModifier,
          verifiedAt: vc.verifiedAt,
        })),
        total: rows.length,
      };
    }),

  // ── Track distribution ───────────────────────────────────────────────────────
  trackDistribution: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const tracks: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
    const results = await Promise.all(
      tracks.map(async track => {
        const [total, verified] = await Promise.all([
          db
            .select({ count: count() })
            .from(candidatesTable)
            .where(eq(candidatesTable.track, track)),
          db
            .select({ count: count() })
            .from(candidatesTable)
            .where(
              and(
                eq(candidatesTable.track, track),
                eq(candidatesTable.citationGatePassed, true)
              )
            ),
        ]);
        return {
          track,
          total: total[0]?.count ?? 0,
          verified: verified[0]?.count ?? 0,
        };
      })
    );

    return results;
  }),

  // ── Query Evolution ──────────────────────────────────────────────────────────────────────────────────
  /**
   * Evolve the discovery query for the next cycle.
   * Accepts optional overrides for previousQuery, lessons, supportedClaims,
   * and contradictedClaims.  When not provided, the procedure reads the most
   * recent evolve_nodes analysis and citation verdicts from the database.
   *
   * Returns the full EvolvedQuery object including rationale and themes.
   */
  evolveQuery: protectedProcedure
    .input(
      z.object({
        previousQuery: z.string().optional(),
        lessons: z.array(z.string()).optional(),
        supportedClaims: z.array(z.string()).optional(),
        contradictedClaims: z.array(z.string()).optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Resolve inputs: use provided values or read from DB
      let previousQuery = input?.previousQuery ?? "";
      let lessons = input?.lessons ?? [];
      let supportedClaims = input?.supportedClaims ?? [];
      let contradictedClaims = input?.contradictedClaims ?? [];

      if (!previousQuery || lessons.length === 0) {
        // Read the most recent evolve_nodes for lessons and citation verdicts
        try {
          const runId = await getOrCreateRun("hiv-protease-run-1");
          const allNodesList = await getAllNodes(runId);
          const recentNodes = allNodesList.slice(-10).reverse();

          if (!previousQuery) {
            // Use the evolved query from the most recent node, or the best node's motivation
            const latestWithQuery = recentNodes.find(
              (n) => (n.metadata as any)?.evolvedQuery
            );
            previousQuery =
              (latestWithQuery?.metadata as any)?.evolvedQuery ??
              "HIV-1 protease inhibitor small molecule binding affinity pIC50 scaffold design";
          }

          if (lessons.length === 0) {
            lessons = recentNodes
              .filter((n) => n.analysis && n.analysis.length > 20)
              .slice(0, 5)
              .map((n) => n.analysis!);
          }

          if (supportedClaims.length === 0 || contradictedClaims.length === 0) {
            for (const n of recentNodes) {
              const verdict = (n.metadata as any)?.citationVerdict as string | undefined;
              const claim = `${n.name}: pIC50=${n.results?.best_pic50?.toFixed(2) ?? "N/A"}, strategy: ${n.motivation?.slice(0, 120) ?? ""}`;
              if (verdict === "Supported" || verdict === "Partially Supported") {
                supportedClaims.push(claim);
              } else if (verdict === "Contradicted") {
                contradictedClaims.push(claim);
              }
            }
          }
        } catch (e) {
          console.warn("[evolveQuery] Failed to read DB context:", (e as Error).message);
        }
      }

      const result = await evolveDiscoveryQuery(
        previousQuery,
        lessons,
        supportedClaims,
        contradictedClaims
      );

      return result;
    }),

  // ── Phase-E: Domain procedures ──────────────────────────────────────────────

  /**
   * Returns the full DomainConfig registry (all 12 domains).
   * Used by the DomainSelector component.
   */
  domainConfigs: publicProcedure.query(() => {
    return ALL_DOMAIN_CONFIGS.map((d) => ({
      id: d.id,
      name: d.name,
      adapters: d.adapters,
      scoringStrategy: d.scoringStrategy,
      verificationVertical: d.verificationVertical,
      quantumEnabled: d.quantumEnabled,
      seedQueryCount: d.cognitionSeedQueries.length,
    }));
  }),

  /**
   * Returns per-domain stats: today's summaries + all-time aggregates.
   */
  domainStats: publicProcedure
    .input(
      z.object({ domainId: z.string().optional() }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const todaySummaries = await getTodayDomainSummaries();

      // All-time aggregates from domain_cycle_summaries
      let allTimeRows: (typeof domainCycleSummaries.$inferSelect)[] = [];
      if (db) {
        try {
          allTimeRows = input?.domainId
            ? await db.select().from(domainCycleSummaries).where(eq(domainCycleSummaries.domainId, input.domainId))
            : await db.select().from(domainCycleSummaries);
        } catch { /* ignore */ }
      }

      // Aggregate by domainId
      const aggregated: Record<string, {
        domainId: string;
        totalCycles: number;
        totalClaimsVerified: number;
        totalSupported: number;
        totalContradicted: number;
        totalAmbiguous: number;
        bestPic50: number | null;
        todayCyclesCompleted: number;
        todayClaimsVerified: number;
      }> = {};

      for (const row of allTimeRows) {
        if (!aggregated[row.domainId]) {
          aggregated[row.domainId] = {
            domainId: row.domainId,
            totalCycles: 0,
            totalClaimsVerified: 0,
            totalSupported: 0,
            totalContradicted: 0,
            totalAmbiguous: 0,
            bestPic50: null,
            todayCyclesCompleted: 0,
            todayClaimsVerified: 0,
          };
        }
        const agg = aggregated[row.domainId]!;
        agg.totalCycles += (row.cyclesCompleted ?? 0) + (row.cyclesFailed ?? 0);
        agg.totalClaimsVerified += row.totalClaimsVerified ?? 0;
        agg.totalSupported += row.totalSupported ?? 0;
        agg.totalContradicted += row.totalContradicted ?? 0;
        agg.totalAmbiguous += row.totalAmbiguous ?? 0;
        if (row.bestPic50 != null) {
          agg.bestPic50 = agg.bestPic50 == null
            ? row.bestPic50
            : Math.max(agg.bestPic50, row.bestPic50);
        }
      }

      for (const today of todaySummaries) {
        if (aggregated[today.domainId]) {
          aggregated[today.domainId]!.todayCyclesCompleted = today.cyclesCompleted;
          aggregated[today.domainId]!.todayClaimsVerified = today.totalClaimsVerified;
        }
      }

      return {
        domains: Object.values(aggregated),
        todaySummaries,
        totalDomainsActive: todaySummaries.filter((s) => s.cyclesCompleted > 0).length,
      };
    }),

  /**
   * Trigger a verification cycle for a specific domain (owner-only).
   */
  triggerDomainCycle: protectedProcedure
    .input(z.object({ domainId: z.enum(DOMAIN_IDS) }))
    .mutation(async ({ input, ctx }) => {
      const ownerOpenId = process.env.OWNER_OPEN_ID;
      if (ownerOpenId && ctx.user.openId !== ownerOpenId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the project owner can trigger domain cycles",
        });
      }
      return runSingleDomain(input.domainId as DomainId);
    }),

  // ── Day-30 Report ─────────────────────────────────────────────────────────

  /**
   * Generate a scientific campaign report (JSON payload).
   * Public — anyone can view the report.
   */
  generateReport: publicProcedure
    .input(
      z.object({
        topN: z.number().int().min(1).max(50).default(10),
        dayWindowDays: z.number().int().min(1).max(90).default(30),
      }).optional()
    )
    .query(async ({ input }) => {
      return generateReport({
        topN: input?.topN ?? 10,
        dayWindowDays: input?.dayWindowDays ?? 30,
      });
    }),

  /**
   * Generate a scientific campaign report as Markdown text.
   * Public — used for the download button on the dashboard.
   */
  generateReportMarkdown: publicProcedure
    .input(
      z.object({
        topN: z.number().int().min(1).max(50).default(10),
        dayWindowDays: z.number().int().min(1).max(90).default(30),
      }).optional()
    )
    .query(async ({ input }) => {
      const report = await generateReport({
        topN: input?.topN ?? 10,
        dayWindowDays: input?.dayWindowDays ?? 30,
      });
      const markdown = renderReportMarkdown(report);
      return { markdown, generatedAt: report.generatedAt, dayNumber: report.dayNumber };
    }),
});
