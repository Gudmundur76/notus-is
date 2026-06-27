/**
 * deCODE Genetics query utilities.
 *
 * Fix 4: Case-insensitive gene matching to handle mixed-case gene symbols
 * from deCODE Genetics datasets (e.g., "pol" vs "POL" vs "Pol").
 */

export interface DecodeVariant {
  gene: string;
  variant: string;
  effect: string;
  frequency?: number;
}

/**
 * Filter variants by gene symbol using case-insensitive comparison.
 *
 * BEFORE (bug — case-sensitive, misses "pol" when searching for "POL"):
 *   const matches = variants.filter(v => v.gene === geneSymbol);
 *
 * AFTER (fixed — case-insensitive):
 *   const matches = variants.filter(v => v.gene.toUpperCase() === geneSymbol.toUpperCase());
 */
export function filterVariantsByGene(
  variants: DecodeVariant[],
  geneSymbol: string
): DecodeVariant[] {
  // Fix 4: Use case-insensitive comparison to handle deCODE gene symbol casing
  const matches = variants.filter(
    (v) => v.gene.toUpperCase() === geneSymbol.toUpperCase()
  );
  return matches;
}
