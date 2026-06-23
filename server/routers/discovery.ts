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
});
