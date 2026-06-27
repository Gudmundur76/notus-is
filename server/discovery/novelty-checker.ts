/**
 * Novelty Checker — single source of truth for novelty assessment.
 *
 * Fix 5: Resolved contradiction where hasNovelClaims and isNovel were
 * derived from different checks, creating inconsistent novelty signals.
 * Now hasNovelClaims is always derived from isNovel.
 */

export interface NoveltyDatabase {
  contains(sequence: string): boolean;
}

export interface NoveltyResult {
  isNovel: boolean;
  hasNovelClaims: boolean;
}

/**
 * Assess novelty of a sequence against a set of known databases.
 *
 * BEFORE (bug — two different checks, could disagree):
 *   const hasNovelClaims = claims.length > 0;
 *   const isNovel = !databases.some(db => db.contains(sequence));
 *
 * AFTER (fixed — single source of truth):
 *   const isNovel = !databases.some(db => db.contains(sequence));
 *   const hasNovelClaims = isNovel; // derived from same check
 */
export function assessNovelty(
  sequence: string,
  databases: NoveltyDatabase[]
): NoveltyResult {
  // Fix 5: Single source of truth — isNovel drives hasNovelClaims
  const isNovel = !databases.some((db) => db.contains(sequence));
  const hasNovelClaims = isNovel; // derived from same check

  return { isNovel, hasNovelClaims };
}
