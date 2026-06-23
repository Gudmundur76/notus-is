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