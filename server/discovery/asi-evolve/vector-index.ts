/**
 * ASI-Evolve Vector Index — TypeScript port of database/faiss_index.py
 *
 * Source uses faiss.IndexFlatIP (exact inner-product / cosine similarity search
 * on L2-normalized vectors, persisted to disk).
 *
 * Since FAISS is a C++ library with no Node.js binding available in this environment,
 * we implement an exact in-memory cosine similarity index backed by MySQL for persistence.
 * The contract is identical: add(id, vector), search(query, top_k, threshold), remove(id).
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve/blob/main/database/faiss_index.py
 */

import mysql from "mysql2/promise";
import { cosineSimilarity, EMBEDDING_DIM } from "./embedding";

let _pool: mysql.Pool | null = null;
function getPool(): mysql.Pool {
  if (!_pool) _pool = mysql.createPool(process.env.DATABASE_URL!);
  return _pool;
}

export interface SearchResult {
  id: number;
  score: number;
}

// ─── In-memory vector store (mirrors faiss.IndexFlatIP) ──────────────────────
// Vectors are stored in memory for fast search and persisted to MySQL for durability.
const _vectors = new Map<number, Float32Array>();
let _loaded = false;

/**
 * Load all persisted vectors from MySQL into memory.
 * Called once on first use (lazy initialization).
 */
async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  const db = getPool();
  try {
    const [rows] = await db.execute(
      `SELECT vector_id, vector_data FROM evolve_vectors`
    ) as [any[], any];
    for (const row of rows) {
      const buf = Buffer.from(row.vector_data, "base64");
      const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      _vectors.set(row.vector_id, arr);
    }
  } catch {
    // Table may not exist yet — will be created on first add()
  }
}

/**
 * Ensure the evolve_vectors table exists.
 */
async function ensureTable(): Promise<void> {
  const db = getPool();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS evolve_vectors (
      vector_id INT NOT NULL PRIMARY KEY,
      vector_data MEDIUMTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Add a vector to the index.
 * Mirrors faiss.IndexFlatIP.add() — stores in memory and persists to MySQL.
 */
export async function addVector(id: number, vector: Float32Array): Promise<void> {
  await ensureLoaded();
  await ensureTable();
  _vectors.set(id, vector);

  const buf = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
  const b64 = buf.toString("base64");
  const db = getPool();
  await db.execute(
    `INSERT INTO evolve_vectors (vector_id, vector_data) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE vector_data = VALUES(vector_data)`,
    [id, b64]
  );
}

/**
 * Remove a vector from the index.
 * Mirrors faiss.IndexFlatIP.remove().
 */
export async function removeVector(id: number): Promise<void> {
  await ensureLoaded();
  _vectors.delete(id);
  const db = getPool();
  await db.execute(`DELETE FROM evolve_vectors WHERE vector_id = ?`, [id]);
}

/**
 * Search for the top-k most similar vectors to a query vector.
 * Mirrors faiss.IndexFlatIP.search() — exact cosine similarity, L2-normalized.
 *
 * @param queryVector - L2-normalized query vector
 * @param topK - number of results to return
 * @param scoreThreshold - minimum cosine similarity (default 0.0)
 */
export async function searchVectors(
  queryVector: Float32Array,
  topK: number = 5,
  scoreThreshold: number = 0.0
): Promise<SearchResult[]> {
  await ensureLoaded();

  const results: SearchResult[] = [];
  for (const [id, vec] of Array.from(_vectors.entries())) {
    const score = cosineSimilarity(queryVector, vec);
    if (score >= scoreThreshold) {
      results.push({ id, score });
    }
  }

  // Sort by score descending, return top-k
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * Reset the index — remove all vectors from memory and MySQL.
 * Mirrors faiss.IndexFlatIP.reset().
 */
export async function resetVectors(): Promise<void> {
  _vectors.clear();
  _loaded = true; // mark as loaded so ensureLoaded() doesn't reload from DB
  const db = getPool();
  await db.execute(`DELETE FROM evolve_vectors`);
}

/**
 * Return the number of vectors in the index.
 */
export function vectorCount(): number {
  return _vectors.size;
}
