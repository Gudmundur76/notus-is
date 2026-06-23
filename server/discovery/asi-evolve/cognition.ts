/**
 * ASI-Evolve Cognition Store — TypeScript port of cognition/cognition.py
 *
 * Upgraded from TF-IDF to dense semantic embeddings (via embedding.ts)
 * with cosine similarity search (via vector-index.ts).
 *
 * The contract is identical to the Python source:
 *   - addCognitionItem(item) → stores with dense vector
 *   - retrieveCognition(runId, query, topK) → returns semantically similar items
 *   - getAllCognition(runId) → returns all items for a run
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve/blob/main/cognition/cognition.py
 */

import mysql from "mysql2/promise";
import type { CognitionItem } from "./types";
import { encodeText as encodeTextDense } from "./embedding";
import { addVector, removeVector, searchVectors } from "./vector-index";

let _pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}

// ─── ID mapping: MySQL auto-increment int → vector index int ─────────────────
// The vector index uses integer IDs matching the MySQL auto-increment primary key.

// ─── Cognition Store ─────────────────────────────────────────────────────────

/** Add a single cognition item to the store with dense embedding */
export async function addCognitionItem(item: Omit<CognitionItem, "id">): Promise<number> {
  const pool = getPool();
  const now = Date.now();

  // Insert first to get the auto-increment ID
  const [result] = await pool.execute(
    `INSERT INTO evolve_cognition 
     (run_id, content, source, source_type, embedding, created_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      item.run_id,
      item.content,
      item.source,
      item.source_type,
      "[]", // placeholder — will be updated after embedding
      now,
      JSON.stringify(item.metadata || {}),
    ]
  ) as [any, any];

  const insertId: number = (result as any).insertId;

  // Generate dense embedding and add to vector index
  try {
    const vector = await encodeTextDense(item.content);
    await addVector(insertId, vector);

    // Store embedding as JSON for fallback retrieval
    const embeddingJson = JSON.stringify(Array.from(vector));
    await pool.execute(
      `UPDATE evolve_cognition SET embedding = ? WHERE id = ?`,
      [embeddingJson, insertId]
    );
  } catch (err) {
    // Non-fatal: item is stored, just without a vector index entry
    console.warn(`[Cognition] Failed to embed item ${insertId}:`, err);
  }

  return insertId;
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
  scoreThreshold: number = 0.0
): Promise<Array<{ item: CognitionItem; score: number }>> {
  const pool = getPool();

  // Get all IDs for this run
  const [idRows] = await pool.execute(
    `SELECT id FROM evolve_cognition WHERE run_id = ? ORDER BY created_at DESC`,
    [runId]
  ) as [any[], any];

  if (idRows.length === 0) return [];

  // Encode query into dense vector
  const queryVector = await encodeTextDense(query);

  // Search vector index
  const vectorResults = await searchVectors(queryVector, topK * 2, scoreThreshold);

  // Filter to only items belonging to this run
  const runIds = new Set(idRows.map((r: any) => r.id));
  const filtered = vectorResults.filter((r) => runIds.has(r.id));

  if (filtered.length === 0) {
    // Fallback: return most recent items if no vector matches
    const [rows] = await pool.execute(
      `SELECT * FROM evolve_cognition WHERE run_id = ? ORDER BY created_at DESC LIMIT ?`,
      [runId, topK]
    ) as [any[], any];
    return rows.map((row: any) => ({ item: deserializeCognitionItem(row), score: 0.5 }));
  }

  // Fetch full rows for matched IDs
  const matchedIds = filtered.slice(0, topK).map((r) => r.id);
  const placeholders = matchedIds.map(() => "?").join(",");
  const [rows] = await pool.execute(
    `SELECT * FROM evolve_cognition WHERE id IN (${placeholders})`,
    matchedIds
  ) as [any[], any];

  // Build result with scores
  const rowMap = new Map(rows.map((r: any) => [r.id, r]));
  return filtered
    .slice(0, topK)
    .filter((r) => rowMap.has(r.id))
    .map((r) => ({
      item: deserializeCognitionItem(rowMap.get(r.id)),
      score: r.score,
    }));
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
      typeof row.embedding === "string" ? JSON.parse(row.embedding) : (row.embedding || []),
    created_at: Number(row.created_at),
    metadata:
      typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata || {}),
  };
}
