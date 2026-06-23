/**
 * ASI-Evolve Manager Agent — TypeScript port of pipeline/manager/manager.py
 *
 * The Manager is the 5th agent in the ASI-Evolve pipeline.
 * It runs periodically (every N steps) to auto-tune the Researcher and Analyzer
 * system prompts based on what has worked and what hasn't.
 *
 * Manager prompt template (from utils/prompts/manager.jinja2):
 *   You are a prompt engineering expert. Generate optimized prompts for the following agents.
 *   ## Task Description: {{ task_description }}
 *   ## Evaluation Criteria: {{ eval_criteria }}
 *   Generate system prompts for:
 *     1. Researcher: generates code based on context
 *     2. Analyzer: analyzes experiment results
 *   Respond using XML tags:
 *     <researcher_prompt>...</researcher_prompt>
 *     <analyzer_prompt>...</analyzer_prompt>
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve/blob/main/pipeline/manager/manager.py
 */

import { invokeLLM } from "../../../server/_core/llm";
import type { EvolveNode } from "./types";

// ─── Manager State ────────────────────────────────────────────────────────────

export interface ManagedPrompts {
  researcherSystemPrompt: string;
  analyzerSystemPrompt: string;
  updatedAt: number;
  stepCount: number;
}

// Default prompts (used before Manager has run)
export const DEFAULT_RESEARCHER_PROMPT = `You are an expert computational chemist specializing in HIV-1 protease inhibitor design.
Your role is to generate novel molecular strategies for discovering potent HIV protease inhibitors.
You have deep knowledge of:
- HIV-1 protease structure (PDB: 1HXW, 3IXO, 2HB4) and binding pocket geometry
- Approved inhibitors: Lopinavir, Darunavir, Atazanavir, Saquinavir, Ritonavir
- Key pharmacophore features: hydroxyethylamine/hydroxyethylene scaffold, P2/P2' group optimization
- Drug-likeness criteria: Lipinski Ro5, TPSA < 140 Å², RotBonds ≤ 10
- Structure-activity relationships from ChEMBL (CHEMBL247) and BindingDB

When generating strategies:
1. Name each approach descriptively (e.g., "scaffold_bis_thf_p2_extension_v3")
2. Explain the scientific motivation clearly
3. Focus on structural modifications with highest predicted impact on pIC50
4. Consider both potency (pIC50) and drug-likeness (ADMET)`;

export const DEFAULT_ANALYZER_PROMPT = `You are an expert computational chemist analyzing HIV-1 protease inhibitor discovery results.
Your role is to extract actionable scientific insights from experimental results.

When analyzing results:
1. Identify which structural features correlate with high pIC50 (≥ 8.0)
2. Note which ADMET properties are limiting drug-likeness
3. Highlight convergence candidates (appearing in multiple tracks)
4. Suggest specific next steps for the Researcher
5. Be concise — 3-5 bullet points maximum
6. Focus on what the data shows, not what you expect`;

// ─── Manager Agent ────────────────────────────────────────────────────────────

/**
 * Run the Manager agent to auto-tune Researcher and Analyzer prompts.
 * Mirrors Manager.run() from the Python source.
 *
 * @param taskDescription - The HIV protease discovery objective
 * @param recentNodes - Recent experiment nodes for context
 * @param currentPrompts - Current Researcher/Analyzer prompts
 * @param stepCount - Current step count (Manager runs every managerInterval steps)
 */
export async function runManager(
  taskDescription: string,
  recentNodes: EvolveNode[],
  currentPrompts: ManagedPrompts,
  stepCount: number
): Promise<ManagedPrompts> {
  // Build performance summary for the Manager
  const successfulNodes = recentNodes.filter((n) => n.success && (n.score || 0) > 0);
  const failedNodes = recentNodes.filter((n) => !n.success || (n.score || 0) === 0);

  const bestNode = successfulNodes.reduce(
    (best, n) => ((n.score || 0) > (best?.score || 0) ? n : best),
    null as EvolveNode | null
  );

  const evalCriteria = `
Primary metric: pIC50 (predicted IC50 in -log10 molar units). Target: ≥ 9.0 (≤ 1 nM IC50).
Secondary metrics:
  - Verification rate: fraction of top candidates verified against PubMed/PDB/ChEMBL
  - ADMET pass rate: fraction passing Lipinski Ro5 + TPSA < 140 + RotBonds ≤ 10
  - Convergence: candidates appearing in 2+ discovery tracks

Recent performance (last ${recentNodes.length} steps):
  - Successful steps: ${successfulNodes.length}/${recentNodes.length}
  - Best pIC50 achieved: ${bestNode ? (bestNode.score || 0).toFixed(4) : "N/A"}
  - Best approach: ${bestNode?.name || "N/A"}
  - Best motivation: ${bestNode?.motivation?.slice(0, 200) || "N/A"}
  - Failed steps: ${failedNodes.length} (${failedNodes.map((n) => n.name).join(", ")})

What worked:
${successfulNodes
  .slice(0, 3)
  .map((n) => `  - ${n.name} (score=${(n.score || 0).toFixed(3)}): ${n.analysis?.slice(0, 150) || "no analysis"}`)
  .join("\n") || "  - No successful steps yet"}

What failed:
${failedNodes
  .slice(0, 3)
  .map((n) => `  - ${n.name}: ${n.results?.error || "no results"}`)
  .join("\n") || "  - No failures"}`;

  const managerPrompt = `You are a prompt engineering expert. Generate optimized prompts for the following agents.

## Task Description
${taskDescription}

## Evaluation Criteria
${evalCriteria}

Generate system prompts for:
1. Researcher: generates molecular strategies based on context and cognition store
2. Analyzer: analyzes experiment results and extracts lessons for the cognition store

Respond using XML tags:
<researcher_prompt>prompt for researcher</researcher_prompt>
<analyzer_prompt>prompt for analyzer</analyzer_prompt>`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "user", content: managerPrompt },
      ],
    });

    const content =
      typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : "";

    // Parse XML tags from response
    const researcherMatch = content.match(/<researcher_prompt>([\s\S]*?)<\/researcher_prompt>/);
    const analyzerMatch = content.match(/<analyzer_prompt>([\s\S]*?)<\/analyzer_prompt>/);

    const newResearcherPrompt = researcherMatch
      ? researcherMatch[1].trim()
      : currentPrompts.researcherSystemPrompt;
    const newAnalyzerPrompt = analyzerMatch
      ? analyzerMatch[1].trim()
      : currentPrompts.analyzerSystemPrompt;

    console.log(`[Manager] Updated prompts at step ${stepCount}`);
    console.log(`[Manager] Researcher prompt length: ${newResearcherPrompt.length} chars`);
    console.log(`[Manager] Analyzer prompt length: ${newAnalyzerPrompt.length} chars`);

    return {
      researcherSystemPrompt: newResearcherPrompt,
      analyzerSystemPrompt: newAnalyzerPrompt,
      updatedAt: Date.now(),
      stepCount,
    };
  } catch (err) {
    console.error("[Manager] Failed to update prompts:", err);
    // Return current prompts unchanged on failure
    return currentPrompts;
  }
}

/**
 * Initialize managed prompts with defaults.
 */
export function initManagedPrompts(): ManagedPrompts {
  return {
    researcherSystemPrompt: DEFAULT_RESEARCHER_PROMPT,
    analyzerSystemPrompt: DEFAULT_ANALYZER_PROMPT,
    updatedAt: Date.now(),
    stepCount: 0,
  };
}
