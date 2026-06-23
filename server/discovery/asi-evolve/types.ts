/**
 * ASI-Evolve TypeScript types — faithful port of utils/structures.py
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve
 */

export interface EvolveResults {
  /** Primary scalar score used for UCB1 sampling — composite of pIC50, verification, ADMET */
  eval_score: number;
  /** Whether the evaluator completed without error */
  success: boolean;
  /** Mean predicted pIC50 of top 10 candidates */
  top10_mean_pic50: number;
  /** Number of top 10 candidates verified against PubMed/PDB/ChEMBL */
  top10_verified_count: number;
  /** Best single-candidate pIC50 in this step */
  best_pic50: number;
  /** SMILES of the best candidate */
  best_smiles: string;
  /** Fraction of top 10 passing all ADMET filters */
  admet_pass_rate: number;
  /** Discovery track (A/B/C/D) of the best candidate */
  track: string;
  /** Quantum VQE score of the best candidate */
  quantum_score?: number;
  /** Raw stdout from evaluator */
  stdout?: string;
  /** Raw stderr from evaluator */
  stderr?: string;
  /** Error message if success=false */
  error?: string;
  /** All top candidates generated in this step */
  top_candidates?: CandidateResult[];
}

export interface CandidateResult {
  smiles: string;
  pic50: number;
  admet: {
    mw: number;
    logp: number;
    hbd: number;
    hba: number;
    tpsa: number;
    rotbonds: number;
    passes: boolean;
  };
  verified: boolean;
  verification_sources: string[];
  track: string;
  quantum_score?: number;
}

/** Faithful port of Node from utils/structures.py */
export interface EvolveNode {
  id?: number;
  run_id: number;
  step_name: string;
  /** Human-readable approach name, e.g. "scaffold_bis_thf_p2_extension_v3" */
  name: string;
  /** Why this approach was chosen — the Researcher's reasoning */
  motivation: string;
  /** The strategy code — TypeScript module that generateCandidates() */
  code: string;
  /** Structured results from the Engineer */
  results: EvolveResults;
  /** Analyzer's distilled lessons */
  analysis: string;
  /** The primary scalar used for UCB1 */
  score: number;
  eval_score: number;
  success: boolean;
  /** IDs of parent nodes this was derived from */
  parent_ids: number[];
  /** UCB1 visit count */
  visit_count: number;
  /** Whether this is the current best node */
  is_best: boolean;
  created_at: number;
  metadata: Record<string, unknown>;
}

/** Faithful port of CognitionItem from utils/structures.py */
export interface CognitionItem {
  id?: number;
  run_id: number;
  /** The knowledge content — paper takeaway, binding data, structural insight */
  content: string;
  /** Source identifier, e.g. "PubMed:12345678", "PDB:1HXW", "ChEMBL:CHEMBL123" */
  source: string;
  source_type: 'pubmed' | 'pdb' | 'chembl' | 'bindingdb' | 'uniprot' | 'manual';
  /** Cosine-similarity embedding vector (384-dim sentence-transformer equivalent) */
  embedding: number[];
  created_at: number;
  metadata: Record<string, unknown>;
}

export interface EvolveRun {
  id?: number;
  name: string;
  objective: string;
  sampling_algorithm: 'ucb1' | 'greedy' | 'random' | 'island';
  ucb1_c: number;
  eval_score_target: number;
  max_steps: number;
  step_count: number;
  best_score: number;
  best_node_id: number | null;
  status: 'running' | 'paused' | 'completed' | 'failed';
  started_at: number;
  updated_at: number;
  metadata: Record<string, unknown>;
}

/** UCB1 sampling result */
export interface SampledContext {
  nodes: EvolveNode[];
  best_node: EvolveNode | null;
  cognition_items: CognitionItem[];
}
