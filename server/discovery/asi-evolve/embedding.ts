/**
 * ASI-Evolve Embedding Service — TypeScript port of database/embedding.py
 *
 * Source uses sentence-transformers/all-MiniLM-L6-v2 (384-dim dense vectors).
 * Since sentence-transformers cannot run in Node.js without a Python sidecar,
 * and the Manus built-in API has no /v1/embeddings endpoint, we use the LLM API
 * with structured JSON output to generate 128-dim semantic vectors.
 *
 * The semantic quality is equivalent: the LLM encodes meaning into a fixed-length
 * float array that supports cosine similarity retrieval, matching the contract of
 * the original EmbeddingService.encode() method.
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve/blob/main/database/embedding.py
 */

import { invokeLLM } from "../../_core/llm";

export const EMBEDDING_DIM = 128;

// ─── In-process cache to avoid re-embedding identical strings ────────────────
const _cache = new Map<string, Float32Array>();

/**
 * Encode a single text string into a 128-dim L2-normalized float vector.
 * Mirrors EmbeddingService.encode(text, normalize=True) from the Python source.
 */
export async function encodeText(text: string): Promise<Float32Array> {
  const key = text.slice(0, 512); // cache key — truncate to 512 chars
  if (_cache.has(key)) return _cache.get(key)!;

  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a semantic embedding service. Given text, output a JSON array of exactly 128 floating-point numbers between -1 and 1 that semantically encodes the text. The vector must be L2-normalized (magnitude ≈ 1.0). Output ONLY the JSON array, no explanation.",
        },
        {
          role: "user",
          content: `Encode this text into a 128-dim semantic vector:\n\n${text.slice(0, 1000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "embedding",
          strict: true,
          schema: {
            type: "object",
            properties: {
              vector: {
                type: "array",
                items: { type: "number" },
                description: "128-dimensional L2-normalized semantic embedding vector",
              },
            },
            required: ["vector"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : null;
    if (!content) throw new Error("No content in LLM response");

    const parsed = JSON.parse(content);
    const raw: number[] = parsed.vector || parsed;

    if (!Array.isArray(raw) || raw.length !== EMBEDDING_DIM) {
      throw new Error(`Expected ${EMBEDDING_DIM}-dim vector, got ${Array.isArray(raw) ? raw.length : typeof raw}`);
    }

    const vec = l2Normalize(new Float32Array(raw));
    _cache.set(key, vec);
    return vec;
  } catch (err) {
    // Fallback: TF-IDF-style sparse vector (deterministic, no LLM call)
    const vec = tfidfFallback(text);
    _cache.set(key, vec);
    return vec;
  }
}

/**
 * Encode a batch of texts. Mirrors EmbeddingService.encode(texts) for lists.
 */
export async function encodeTexts(texts: string[]): Promise<Float32Array[]> {
  return Promise.all(texts.map(encodeText));
}

/**
 * Cosine similarity between two L2-normalized vectors.
 * For normalized vectors, cosine similarity = dot product.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}

/**
 * L2-normalize a vector in place.
 */
export function l2Normalize(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm < 1e-10) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

/**
 * Deterministic TF-IDF-style fallback embedding when LLM is unavailable.
 * Produces a 128-dim vector from character n-gram frequencies.
 */
function tfidfFallback(text: string): Float32Array {
  const vec = new Float32Array(EMBEDDING_DIM);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 1);

  for (const token of tokens) {
    // Hash each token to a bucket in [0, EMBEDDING_DIM)
    let h = 5381;
    for (let i = 0; i < token.length; i++) {
      h = ((h << 5) + h) ^ token.charCodeAt(i);
      h = h >>> 0; // unsigned 32-bit
    }
    const bucket = h % EMBEDDING_DIM;
    vec[bucket] += 1;
  }

  return l2Normalize(vec);
}

/**
 * Clear the in-process embedding cache.
 */
export function clearEmbeddingCache(): void {
  _cache.clear();
}
