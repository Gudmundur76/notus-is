import {
  boolean,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ENGINE TABLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed corpus — curated HIV protease inhibitor reference molecules.
 */
export const corpus = mysqlTable("corpus", {
  id: int("id").autoincrement().primaryKey(),
  refId: varchar("refId", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  smiles: text("smiles").notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  pIC50: float("pIC50").notNull(),
  confidence: float("confidence").notNull(),
  scaffold: varchar("scaffold", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CorpusEntry = typeof corpus.$inferSelect;
export type InsertCorpusEntry = typeof corpus.$inferInsert;

/**
 * Discovery cycles — one row per run_single_cycle() call.
 */
export const cycles = mysqlTable("cycles", {
  id: int("id").autoincrement().primaryKey(),
  cycleNumber: int("cycleNumber").notNull(),
  dayNumber: int("dayNumber").notNull().default(1),
  corpusSize: int("corpusSize").notNull().default(0),
  candidatesGenerated: int("candidatesGenerated").notNull().default(0),
  candidatesVerified: int("candidatesVerified").notNull().default(0),
  bestPic50: float("bestPic50").notNull().default(0),
  convergenceCandidates: int("convergenceCandidates").notNull().default(0),
  citationPassRate: varchar("citationPassRate", { length: 32 }).default("0/0"),
  convergenceReport: json("convergenceReport"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Cycle = typeof cycles.$inferSelect;
export type InsertCycle = typeof cycles.$inferInsert;

/**
 * Candidates — generated molecules from the 4-track discovery loop.
 */
export const candidates = mysqlTable("candidates", {
  id: int("id").autoincrement().primaryKey(),
  cycleId: int("cycleId").notNull(),
  smiles: text("smiles").notNull(),
  parentSmiles: text("parentSmiles"),
  track: mysqlEnum("track", ["A", "B", "C", "D"]).notNull(),
  modificationType: varchar("modificationType", { length: 64 }),
  pic50Predicted: float("pic50Predicted"),
  confidenceScore: float("confidenceScore").default(0),
  pic50Vqe: float("pic50Vqe"),
  quantumHardware: varchar("quantumHardware", { length: 64 }),
  quantumScore: float("quantumScore"),
  provenanceStatus: varchar("provenanceStatus", { length: 32 }),
  citationVerdict: varchar("citationVerdict", { length: 64 }),
  citationConfidence: float("citationConfidence"),
  citationGatePassed: boolean("citationGatePassed").default(false),
  pubmedIds: json("pubmedIds").$type<string[]>().default([]),
  citationIds: json("citationIds").$type<string[]>().default([]),
  mw: float("mw"),
  logp: float("logp"),
  hbd: int("hbd"),
  hba: int("hba"),
  tpsa: float("tpsa"),
  lipinskiViolations: int("lipinskiViolations"),
  isDruglike: boolean("isDruglike").default(false),
  isNovel: boolean("isNovel").default(true),
  tanimotoToApproved: float("tanimotoToApproved"),
  isBestSoFar: boolean("isBestSoFar").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = typeof candidates.$inferInsert;

/**
 * Citation registry — permanent citation.is URLs per candidate.
 */
export const citationRegistry = mysqlTable("citationRegistry", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(),
  citationUrl: text("citationUrl").notNull(),
  claimText: text("claimText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CitationRegistryEntry = typeof citationRegistry.$inferSelect;
export type InsertCitationRegistryEntry = typeof citationRegistry.$inferInsert;

/**
 * Cognition store — persistent knowledge base for the discovery loop.
 */
export const cognitionStore = mysqlTable("cognitionStore", {
  id: int("id").autoincrement().primaryKey(),
  targetChemblId: varchar("targetChemblId", { length: 32 }).notNull(),
  targetName: varchar("targetName", { length: 128 }).notNull(),
  bestAffinityEver: float("bestAffinityEver"),
  bestSmilsEver: text("bestSmilsEver"),
  bestPic50Ever: float("bestPic50Ever"),
  cycleCount: int("cycleCount").notNull().default(0),
  dayNumber: int("dayNumber").notNull().default(1),
  accumulatedLessons: json("accumulatedLessons").$type<string[]>().default([]),
  statisticalPatterns: json("statisticalPatterns").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CognitionStoreRow = typeof cognitionStore.$inferSelect;
export type InsertCognitionStoreRow = typeof cognitionStore.$inferInsert;

/**
 * Daily logs — one row per day, written by the HIV loop extension.
 */
export const dailyLogs = mysqlTable("dailyLogs", {
  id: int("id").autoincrement().primaryKey(),
  dayNumber: int("dayNumber").notNull().unique(),
  cycleCount: int("cycleCount").notNull().default(0),
  summary: text("summary"),
  runData: json("runData"),
  convergenceReport: json("convergenceReport"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyLog = typeof dailyLogs.$inferSelect;
export type InsertDailyLog = typeof dailyLogs.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// ASI-EVOLVE TABLES
// Ported from GAIR-NLP/ASI-Evolve: database/database.py, evolve_core/run_state.py
// ─────────────────────────────────────────────────────────────────────────────

import { bigint, double } from "drizzle-orm/mysql-core";

/**
 * ASI-Evolve runs — one row per named experiment run.
 * Includes run_state.py fields: managed_prompts, island_state.
 */
export const evolveRuns = mysqlTable("evolve_runs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  objective: text("objective").notNull(),
  samplingAlgorithm: varchar("sampling_algorithm", { length: 50 }).notNull().default("ucb1"),
  ucb1C: double("ucb1_c").notNull().default(1.414),
  evalScoreTarget: double("eval_score_target").notNull().default(9.5),
  maxSteps: int("max_steps").notNull().default(100),
  stepCount: int("step_count").notNull().default(0),
  bestScore: double("best_score").notNull().default(0),
  bestNodeId: int("best_node_id"),
  status: mysqlEnum("status", ["running", "paused", "completed", "failed"]).notNull().default("running"),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  metadata: json("metadata").notNull(),
  // Run state persistence (run_state.py equivalent)
  managedPrompts: json("managed_prompts").$type<Record<string, unknown>>(),
  islandState: json("island_state").$type<Record<string, unknown>>(),
});

export type EvolveRun = typeof evolveRuns.$inferSelect;
export type InsertEvolveRun = typeof evolveRuns.$inferInsert;

/**
 * ASI-Evolve nodes — one row per step execution.
 */
export const evolveNodes = mysqlTable("evolve_nodes", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  stepName: varchar("step_name", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  motivation: text("motivation"),
  code: text("code"),
  results: json("results"),
  analysis: text("analysis"),
  score: double("score").notNull().default(0),
  evalScore: double("eval_score").notNull().default(0),
  success: boolean("success").notNull().default(false),
  parentIds: json("parent_ids"),
  visitCount: int("visit_count").notNull().default(0),
  isBest: boolean("is_best").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  metadata: json("metadata"),
  // citation.manus.space verdict fields (Phase 5)
  citationVerdict: varchar("citation_verdict", { length: 50 }),
  citationDocId: varchar("citation_doc_id", { length: 100 }),
  citationConfidence: double("citation_confidence"),
});

export type EvolveNode = typeof evolveNodes.$inferSelect;
export type InsertEvolveNode = typeof evolveNodes.$inferInsert;

/**
 * ASI-Evolve cognition — semantic memory items with embeddings.
 */
export const evolveCognition = mysqlTable("evolve_cognition", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 128 }),
  embedding: json("embedding"),
  score: double("score").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  metadata: json("metadata"),
});

export type EvolveCognitionItem = typeof evolveCognition.$inferSelect;
export type InsertEvolveCognitionItem = typeof evolveCognition.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PHASE-C: VERIFICATION CYCLE TABLE
// Unified 6-phase cycle: DISCOVER → SCORE → VERIFY → COGNITION → EVOLVE → CONVERGENCE
// ─────────────────────────────────────────────────────────────────────────────

export type PhaseStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface PhaseResult {
  status: PhaseStatus;
  startedAt: number;   // epoch ms
  completedAt: number; // epoch ms
  durationMs: number;
  itemsProcessed: number;
  summary: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface VerificationCyclePhases {
  discovery:   PhaseResult;
  scoring:     PhaseResult;
  verification: PhaseResult;
  cognition:   PhaseResult;
  evolve:      PhaseResult;
  convergence: PhaseResult;
}

/**
 * Verification cycles — one row per runVerificationCycle() invocation.
 * Captures all 6 phases with timing, item counts, and structured results.
 */
export const verificationCycles = mysqlTable("verification_cycles", {
  id:          int("id").autoincrement().primaryKey(),
  cycleId:     varchar("cycle_id", { length: 36 }).notNull().unique(), // UUID
  startedAt:   timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status:      mysqlEnum("status", ["running", "completed", "failed"]).notNull().default("running"),
  phases:      json("phases").$type<VerificationCyclePhases>(),
  // Summary stats (denormalised for quick tRPC queries)
  candidatesDiscovered: int("candidates_discovered").notNull().default(0),
  candidatesScored:     int("candidates_scored").notNull().default(0),
  claimsVerified:       int("claims_verified").notNull().default(0),
  cognitionItemsAdded:  int("cognition_items_added").notNull().default(0),
  evolveStepName:       varchar("evolve_step_name", { length: 64 }),
  evolveScore:          float("evolve_score"),
  convergenceReached:   boolean("convergence_reached").notNull().default(false),
  bestPic50:            float("best_pic50"),
  errorMessage:         text("error_message"),
  durationMs:           int("duration_ms"),
});

export type VerificationCycleRow = typeof verificationCycles.$inferSelect;
export type InsertVerificationCycleRow = typeof verificationCycles.$inferInsert;
