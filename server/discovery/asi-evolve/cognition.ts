/**
 * ASI-Evolve Cognition Store — TypeScript port of cognition/cognition.py
 * Uses TF-IDF cosine similarity as an embedding-free alternative to FAISS.
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

import mysql from "mysql2/promise";
import type { CognitionItem } from "./types";

let _pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}

// ─── TF-IDF Embedding (lightweight, no external deps) ────────────────────────

/**
 * Build a simple TF-IDF-style term frequency vector for semantic retrieval.
 * This replaces the sentence-transformers FAISS approach from the Python source
 * with a lightweight in-process implementation that requires no external models.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function buildTfVector(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  const total = tokens.length || 1;
  const tf = new Map<string, number>();
  Array.from(freq.entries()).forEach(([t, c]) => tf.set(t, c / total));
  return tf;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  Array.from(a.entries()).forEach(([t, v]) => {
    dot += v * (b.get(t) || 0);
    normA += v * v;
  });
  Array.from(b.values()).forEach((v) => (normB += v * v));
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Encode text as a flat Float32 array (stored as JSON in DB) */
export function encodeText(text: string): number[] {
  const tokens = tokenize(text);
  const tf = buildTfVector(tokens);
  // Use a fixed 256-dim hash-based projection for storage compatibility
  const vec = new Array(256).fill(0);
  Array.from(tf.entries()).forEach(([t, v]) => {
    // Simple hash projection
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    vec[h % 256] += v;
  });
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

// ─── Cognition Store ─────────────────────────────────────────────────────────

/** Add a single cognition item to the store */
export async function addCognitionItem(item: Omit<CognitionItem, "id">): Promise<number> {
  const pool = getPool();
  const embedding = encodeText(item.content);
  const now = Date.now();

  const [result] = await pool.execute(
    `INSERT INTO evolve_cognition 
     (run_id, content, source, source_type, embedding, created_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      item.run_id,
      item.content,
      item.source,
      item.source_type,
      JSON.stringify(embedding),
      now,
      JSON.stringify(item.metadata || {}),
    ]
  ) as [any, any];

  return (result as any).insertId;
}

/** Add multiple cognition items in batch */
export async function addCognitionBatch(items: Omit<CognitionItem, "id">[]): Promise<number[]> {
  const ids: number[] = [];
  for (const item of items) {
    ids.push(await addCognitionItem(item));
  }
  return ids;
}

/** Retrieve top-k cognition items most semantically similar to the query */
export async function retrieveCognition(
  runId: number,
  query: string,
  topK: number = 5,
  scoreThreshold: number = 0.1
): Promise<Array<{ item: CognitionItem; score: number }>> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM evolve_cognition WHERE run_id = ? ORDER BY created_at DESC`,
    [runId]
  ) as [any[], any];

  if (rows.length === 0) return [];

  const queryVec = encodeText(query);
  const queryMap = new Map(queryVec.map((v, i) => [String(i), v]));

  const scored = rows.map((row: any) => {
    const embedding: number[] =
      typeof row.embedding === "string" ? JSON.parse(row.embedding) : row.embedding;
    const itemMap = new Map(embedding.map((v, i) => [String(i), v]));
    const score = cosineSimilarity(queryMap, itemMap);
    return {
      item: deserializeCognitionItem(row),
      score,
    };
  });

  return scored
    .filter((r) => r.score >= scoreThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Get all cognition items for a run */
export async function getAllCognition(runId: number): Promise<CognitionItem[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM evolve_cognition WHERE run_id = ? ORDER BY created_at DESC`,
    [runId]
  ) as [any[], any];
  return rows.map(deserializeCognitionItem);
}

/** Count cognition items for a run */
export async function getCognitionCount(runId: number): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM evolve_cognition WHERE run_id = ?`,
    [runId]
  ) as [any[], any];
  return Number(rows[0].cnt);
}

// ─── Serialization ───────────────────────────────────────────────────────────

function deserializeCognitionItem(row: any): CognitionItem {
  return {
    id: row.id,
    run_id: row.run_id,
    content: row.content,
    source: row.source,
    source_type: row.source_type,
    embedding:
      typeof row.embedding === "string" ? JSON.parse(row.embedding) : row.embedding,
    created_at: Number(row.created_at),
    metadata:
      typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
  };
}
