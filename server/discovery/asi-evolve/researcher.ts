/**
 * ASI-Evolve Researcher Agent — TypeScript port of pipeline/researcher/researcher.py
 * Generates novel molecular design strategies using LLM + cognition store context.
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

import { invokeLLM } from "../../_core/llm";
import { retrieveCognition } from "./cognition";
import type { EvolveNode, SampledContext } from "./types";

// ─── Strategy Generation ──────────────────────────────────────────────────────

export interface ResearchStrategy {
  name: string;
  motivation: string;
  approach: string;
  expected_improvement: string;
  code_template: string;
}

/**
 * Generate a novel molecular design strategy.
 * Faithful to ASI-Evolve's Researcher role:
 * - Reads cognition store for relevant knowledge
 * - Reads top-performing nodes for what has worked
 * - Proposes a new strategy that builds on successes and avoids failures
 */
export async function generateStrategy(
  runId: number,
  context: SampledContext,
  stepName: string
): Promise<ResearchStrategy> {
  // Retrieve relevant cognition items
  const cognitionQuery = `HIV protease inhibitor binding affinity pIC50 scaffold design ${stepName}`;
  const cognitionItems = await retrieveCognition(runId, cognitionQuery, 8, 0.05);

  const cognitionContext = cognitionItems
    .map((c) => `[${c.item.source}] ${c.item.content}`)
    .join("\n\n");

  const bestNodeSummary = context.best_node
    ? `Best approach so far: "${context.best_node.name}" (score=${context.best_node.score.toFixed(3)}, pIC50_best=${(context.best_node.results?.best_pic50 || 0).toFixed(2)})
Strategy: ${context.best_node.motivation}
Analysis: ${context.best_node.analysis || "No analysis yet"}`
    : "No successful approaches yet — this is the first step.";

  const topNodesSummary = context.nodes.length > 0
    ? context.nodes.slice(0, 3).map((n, i) =>
        `${i + 1}. "${n.name}" (score=${n.score.toFixed(3)}): ${n.motivation.slice(0, 150)}`
      ).join("\n")
    : "No previous approaches.";

  const prompt = `You are an expert computational chemist designing HIV-1 protease inhibitors.

## Objective
Maximize eval_score = 0.6 * mean_pIC50_top10 + 0.3 * verification_rate + 0.1 * admet_pass_rate
Target: eval_score > 9.5 (corresponding to mean pIC50 > 9.5 nM for top 10 candidates)

## Knowledge Base (from PubMed, ChEMBL, PDB, UniProt)
${cognitionContext || "No cognition items available yet."}

## Previous Approaches
${topNodesSummary}

## Current Best
${bestNodeSummary}

## Your Task
Design a novel molecular generation strategy for step "${stepName}".

Requirements:
1. Build on what worked in previous approaches
2. Avoid repeating failed strategies
3. Use verified knowledge from the knowledge base
4. Focus on structural modifications that improve pIC50 while maintaining ADMET properties
5. Be specific about which scaffolds, substituents, or design principles to use

Respond with a JSON object (no markdown, no code blocks):
{
  "name": "short_snake_case_strategy_name",
  "motivation": "2-3 sentences explaining why this approach will work, citing specific knowledge",
  "approach": "detailed description of the molecular design approach",
  "expected_improvement": "specific prediction of improvement over current best",
  "scaffold_focus": "primary scaffold or chemical series to explore",
  "key_modifications": ["modification1", "modification2", "modification3"],
  "admet_considerations": "how this approach maintains drug-likeness"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert computational chemist. Always respond with valid JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "research_strategy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              motivation: { type: "string" },
              approach: { type: "string" },
              expected_improvement: { type: "string" },
              scaffold_focus: { type: "string" },
              key_modifications: { type: "array", items: { type: "string" } },
              admet_considerations: { type: "string" },
            },
            required: ["name", "motivation", "approach", "expected_improvement", "scaffold_focus", "key_modifications", "admet_considerations"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty LLM response");
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    const parsed = JSON.parse(content);

    // Build the code template for the Engineer to execute
    const codeTemplate = buildCodeTemplate(parsed);

    return {
      name: parsed.name || `strategy_${stepName}`,
      motivation: parsed.motivation || "",
      approach: parsed.approach || "",
      expected_improvement: parsed.expected_improvement || "",
      code_template: codeTemplate,
    };
  } catch (e) {
    console.warn("[Researcher] LLM strategy generation failed, using fallback:", e);
    return buildFallbackStrategy(stepName, context);
  }
}

/**
 * Build a TypeScript code template from the strategy.
 * The Engineer will execute this to generate candidates.
 */
function buildCodeTemplate(strategy: any): string {
  const scaffoldFocus = strategy.scaffold_focus || "hydroxyethylamine";
  const modifications = (strategy.key_modifications || []).join(", ");

  return `// Strategy: ${strategy.name}
// Focus: ${scaffoldFocus}
// Modifications: ${modifications}
// Generated by ASI-Evolve Researcher

const SCAFFOLD_FOCUS = "${scaffoldFocus}";
const KEY_MODIFICATIONS = ${JSON.stringify(strategy.key_modifications || [])};
const APPROACH = ${JSON.stringify(strategy.approach || "")};
`;
}

/**
 * Fallback strategy when LLM is unavailable.
 * Cycles through 4 known-good approaches.
 */
function buildFallbackStrategy(stepName: string, context: SampledContext): ResearchStrategy {
  const stepNum = parseInt(stepName.replace(/\D/g, "")) || 1;
  const fallbacks = [
    {
      name: "bis_thf_p2_extension",
      motivation: "Darunavir's bis-THF P2 group forms unique H-bonds with Asp29/Asp30. Extending this scaffold with P2' modifications should improve potency.",
      approach: "Generate bis-THF scaffold variants with systematic P2' substitutions (sulfonamide, aniline, benzamide).",
      expected_improvement: "pIC50 improvement of 0.3-0.5 over baseline based on darunavir SAR data.",
      code_template: "// Fallback: bis-THF P2 extension strategy",
    },
    {
      name: "cyclic_urea_scaffold",
      motivation: "Cyclic urea inhibitors (DMP323, DMP450) achieve sub-nanomolar potency through symmetric binding. Novel asymmetric variants may improve selectivity.",
      approach: "Generate asymmetric cyclic urea variants with varied P1/P1' groups targeting the hydrophobic S1/S1' pockets.",
      expected_improvement: "Novel scaffold diversity reduces resistance liability while maintaining pIC50 > 9.",
      code_template: "// Fallback: cyclic urea scaffold strategy",
    },
    {
      name: "fragment_growing_p2",
      motivation: "Fragment-based approach: start with validated P2 fragments (4-aminobenzamide, bis-THF) and grow toward P1' pocket.",
      approach: "Enumerate P2 fragment + linker + P1' combinations using SMILES concatenation.",
      expected_improvement: "Fragment-grown compounds typically achieve pIC50 7-9 with good ADMET.",
      code_template: "// Fallback: fragment growing P2 strategy",
    },
    {
      name: "scaffold_hopping_tipranavir",
      motivation: "Tipranavir's non-peptidic dihydropyrone scaffold overcomes resistance to peptidomimetic inhibitors.",
      approach: "Generate dihydropyrone and coumarin-based scaffolds with varied aryl substituents.",
      expected_improvement: "Non-peptidic scaffolds improve oral bioavailability (LogP 2-4) while maintaining pIC50 > 8.",
      code_template: "// Fallback: scaffold hopping tipranavir strategy",
    },
  ];

  return fallbacks[(stepNum - 1) % fallbacks.length];
}

/**
 * Generate the analysis prompt for the Analyzer agent.
 * Called after Engineer results are available.
 */
export async function generateAnalysisPrompt(
  node: EvolveNode,
  bestNode: EvolveNode | null
): Promise<string> {
  const improvement = bestNode
    ? node.score - bestNode.score
    : node.score;

  return `Analyze these HIV protease inhibitor discovery results:

Strategy: "${node.name}"
Motivation: ${node.motivation}
Score: ${node.score.toFixed(3)} (${improvement >= 0 ? "+" : ""}${improvement.toFixed(3)} vs best)
Best pIC50: ${node.results?.best_pic50?.toFixed(2) || "N/A"}
Top-10 mean pIC50: ${node.results?.top10_mean_pic50?.toFixed(2) || "N/A"}
Verified candidates: ${node.results?.top10_verified_count || 0}/10
ADMET pass rate: ${((node.results?.admet_pass_rate || 0) * 100).toFixed(0)}%
Best SMILES: ${node.results?.best_smiles || "N/A"}

Provide a concise analysis (3-5 sentences) covering:
1. What worked and why
2. What failed and why
3. Specific structural insights for future strategies
4. Recommended next modification`;
}
