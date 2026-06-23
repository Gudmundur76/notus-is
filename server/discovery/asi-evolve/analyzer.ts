/**
 * ASI-Evolve Analyzer Agent — TypeScript port of pipeline/analyzer.py
 * Analyzes Engineer results to extract lessons and update the cognition store.
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

import { invokeLLM } from "../../_core/llm";
import { addCognitionItem } from "./cognition";
import type { EvolveNode } from "./types";

/**
 * Analyze the results of a completed node.
 * Returns a concise analysis string that becomes part of the node record
 * and is used by future Researcher calls.
 */
export async function analyzeNode(
  node: EvolveNode,
  bestNode: EvolveNode | null,
  systemPrompt?: string
): Promise<string> {
  const improvement = bestNode
    ? node.score - bestNode.score
    : node.score;

  const improvementStr = improvement >= 0
    ? `+${improvement.toFixed(3)} improvement over previous best`
    : `${improvement.toFixed(3)} below previous best`;

  const prompt = `You are an expert computational chemist analyzing HIV-1 protease inhibitor discovery results.

## Step Results
Strategy: "${node.name}"
Motivation: ${node.motivation}
Score: ${node.score.toFixed(3)} (${improvementStr})
Best pIC50: ${node.results?.best_pic50?.toFixed(2) || "N/A"}
Top-10 mean pIC50: ${node.results?.top10_mean_pic50?.toFixed(2) || "N/A"}
Verified candidates: ${node.results?.top10_verified_count || 0}/10
ADMET pass rate: ${((node.results?.admet_pass_rate || 0) * 100).toFixed(0)}%
Best SMILES: ${node.results?.best_smiles || "N/A"}
Success: ${node.success}

## Task
Provide a concise analysis (3-5 sentences) covering:
1. What structural features drove the score (or caused failure)
2. Specific SAR insight: which modifications helped/hurt pIC50
3. ADMET observations: what limited drug-likeness
4. One concrete recommendation for the next strategy

Be specific about chemistry — name scaffolds, substituents, and binding interactions.`;

  // Use Manager-tuned prompt if provided, otherwise use default
  const effectiveSystemPrompt = systemPrompt && systemPrompt.trim().length > 0
    ? systemPrompt
    : "You are an expert computational chemist. Provide concise, specific chemical analysis.";

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: effectiveSystemPrompt,
        },
        { role: "user", content: prompt },
      ],
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    if (!rawContent) return buildFallbackAnalysis(node, improvement);
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    return content.slice(0, 1000); // cap at 1000 chars
  } catch {
    return buildFallbackAnalysis(node, improvement);
  }
}

/**
 * Extract cognition items from a completed node and add them to the store.
 * This is the "Learn" phase of ASI-Evolve's loop.
 */
export async function extractAndStoreCognition(
  runId: number,
  node: EvolveNode
): Promise<number> {
  if (!node.success || !node.results?.top_candidates?.length) return 0;

  const items: Array<{ content: string; source: string }> = [];

  // 1. Store the best candidate as a cognition item
  if (node.results.best_smiles && node.results.best_pic50 > 7.0) {
    items.push({
      content: `[Discovery] Strategy "${node.name}" found candidate with pIC50=${node.results.best_pic50.toFixed(2)}: SMILES=${node.results.best_smiles.slice(0, 100)}. ${node.analysis || ""}`,
      source: `discovery:${node.step_name}:best`,
    });
  }

  // 2. Store the analysis as a cognition item for future reference
  if (node.analysis && node.analysis.length > 50) {
    items.push({
      content: `[Analysis:${node.step_name}] ${node.analysis}`,
      source: `analysis:${node.step_name}`,
    });
  }

  // 3. Store top verified candidates
  const verified = (node.results.top_candidates || []).filter((c) => c.verified).slice(0, 3);
  for (const candidate of verified) {
    items.push({
      content: `[Verified:${node.step_name}] pIC50=${candidate.pic50.toFixed(2)}, Track=${candidate.track}, SMILES=${candidate.smiles.slice(0, 80)}, Sources=${candidate.verification_sources.join(",")}`,
      source: `verified:${node.step_name}:${candidate.smiles.slice(0, 20)}`,
    });
  }

  let added = 0;
  for (const item of items) {
    try {
      await addCognitionItem({
        run_id: runId,
        content: item.content,
        source: item.source,
        source_type: "manual",
        embedding: [],
        created_at: Date.now(),
        metadata: { step_name: node.step_name, score: node.score },
      });
      added++;
    } catch { /* non-fatal */ }
  }

  return added;
}

function buildFallbackAnalysis(node: EvolveNode, improvement: number): string {
  if (!node.success) {
    return `Strategy "${node.name}" failed to generate valid candidates. The approach may have produced invalid SMILES or all candidates failed ADMET filters. Recommend simplifying the scaffold and reducing molecular weight.`;
  }

  const pic50 = node.results?.best_pic50 || 0;
  const verified = node.results?.top10_verified_count || 0;
  const admet = node.results?.admet_pass_rate || 0;

  if (improvement > 0) {
    return `Strategy "${node.name}" improved the score by ${improvement.toFixed(3)}. Best pIC50=${pic50.toFixed(2)}, ${verified}/10 verified, ${(admet * 100).toFixed(0)}% ADMET pass rate. The approach shows promise — continue exploring this scaffold family with more diverse P1/P1' substitutions.`;
  } else {
    return `Strategy "${node.name}" did not improve over the best (score delta=${improvement.toFixed(3)}). Best pIC50=${pic50.toFixed(2)}, ${verified}/10 verified. Consider switching scaffold family or focusing on ADMET optimization (current pass rate: ${(admet * 100).toFixed(0)}%).`;
  }
}
