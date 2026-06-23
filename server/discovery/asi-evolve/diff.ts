/**
 * ASI-Evolve SEARCH/REPLACE Diff Engine — TypeScript port of utils/diff.py
 *
 * Parses and applies SEARCH/REPLACE diff blocks from LLM responses.
 * Used by the Researcher agent (researcher_diff mode) to generate incremental
 * modifications to the base strategy code rather than full rewrites.
 *
 * Format:
 *   <<<<<<< SEARCH
 *   # Original code to find and replace (must match exactly)
 *   =======
 *   # New replacement code
 *   >>>>>>> REPLACE
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve/blob/main/utils/diff.py
 */

export type DiffBlock = [string, string]; // [search_text, replace_text]

/**
 * Parse SEARCH/REPLACE diff blocks from an LLM response.
 * Mirrors parse_diff_blocks() from the Python source.
 *
 * @param llmResponse - Raw LLM response containing diff blocks
 * @returns Array of [search_text, replace_text] tuples
 */
export function parseDiffBlocks(llmResponse: string): DiffBlock[] {
  const blocks: DiffBlock[] = [];

  // Pattern: <<<<<<< SEARCH\n...\n=======\n...\n>>>>>>> REPLACE
  const pattern = /<<<<<<< SEARCH\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> REPLACE/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(llmResponse)) !== null) {
    const searchText = match[1];
    const replaceText = match[2];
    blocks.push([searchText, replaceText]);
  }

  return blocks;
}

/**
 * Apply a single diff block to code.
 * Mirrors apply_diff() from the Python source.
 * Throws if the search text is not found.
 *
 * @param code - Original code
 * @param searchText - Text to find (must match exactly)
 * @param replaceText - Replacement text
 */
export function applyDiff(code: string, searchText: string, replaceText: string): string {
  if (!code.includes(searchText)) {
    throw new Error(
      `Search text not found in code.\nSearch text:\n${searchText.slice(0, 200)}...`
    );
  }
  return code.replace(searchText, replaceText);
}

/**
 * Apply multiple diff blocks to code, throwing on first failure.
 * Mirrors apply_diffs() from the Python source.
 *
 * @param code - Original code
 * @param blocks - Array of [search_text, replace_text] tuples
 */
export function applyDiffs(code: string, blocks: DiffBlock[]): string {
  let result = code;
  for (let i = 0; i < blocks.length; i++) {
    const [searchText, replaceText] = blocks[i];
    if (!result.includes(searchText)) {
      throw new Error(
        `Diff block ${i + 1}: Search text not found in code.\nSearch text:\n${searchText.slice(0, 200)}...`
      );
    }
    result = result.replace(searchText, replaceText);
  }
  return result;
}

/**
 * Apply diff blocks to code, skipping blocks where search text is not found.
 * Mirrors apply_diff_blocks() from the Python source.
 *
 * @param code - Original code
 * @param blocks - Array of [search_text, replace_text] tuples
 * @returns [updated_code, applied_count]
 */
export function applyDiffBlocks(code: string, blocks: DiffBlock[]): [string, number] {
  let result = code;
  let appliedCount = 0;

  for (const [searchText, replaceText] of blocks) {
    if (result.includes(searchText)) {
      result = result.replace(searchText, replaceText);
      appliedCount++;
    }
  }

  return [result, appliedCount];
}

/**
 * Extract a full code rewrite from an LLM response (non-diff mode).
 * Mirrors parse_full_rewrite() from the Python source.
 *
 * @param llmResponse - Raw LLM response
 * @param language - Preferred fenced-code language tag (default "python")
 */
export function parseFullRewrite(llmResponse: string, language: string = "python"): string | null {
  // Try language-specific code block first
  const langPattern = new RegExp("```" + language + "\\n([\\s\\S]*?)```");
  const langMatch = langPattern.exec(llmResponse);
  if (langMatch) return langMatch[1].trim();

  // Fall back to any code block
  const anyPattern = /```(?:\w+\n)?([\s\S]*?)```/;
  const anyMatch = anyPattern.exec(llmResponse);
  if (anyMatch) return anyMatch[1].trim();

  return null;
}

/**
 * Create a human-readable summary of diff blocks.
 * Mirrors format_diff_summary() from the Python source.
 */
export function formatDiffSummary(blocks: DiffBlock[]): string {
  if (blocks.length === 0) return "No changes";

  return blocks
    .map(([searchText, replaceText], i) => {
      const searchLines = searchText.trim().split("\n");
      const replaceLines = replaceText.trim().split("\n");
      if (searchLines.length === 1 && replaceLines.length === 1) {
        return `Edit ${i + 1}: '${searchLines[0].slice(0, 50)}...' -> '${replaceLines[0].slice(0, 50)}...'`;
      }
      return `Edit ${i + 1}: replace ${searchLines.length} lines with ${replaceLines.length} lines`;
    })
    .join("\n");
}
