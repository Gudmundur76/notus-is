/**
 * server/discovery/index.ts — Barrel export for the discovery module.
 * Provides a single import point for all public discovery APIs.
 */

// Python bridge — subprocess interface to the 60-source Python discovery engine
export { pythonBridge, type DiscoveryReport, type QuantumScoreResult } from "./python-bridge";

// Unified source registry — all 65 sources (TypeScript + Python)
export {
  getAllSources,
  getPythonOnlySources,
  getSourcesByDomain,
  getQuantumEligibleSources,
  type SourceRegistry,
} from "./python-adapter";

// Predictor — ML ensemble + quantum VQE scoring
export { predictPic50, predictBatch, quantumScore } from "./predictor";
