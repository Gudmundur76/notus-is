/**
 * ASI-Evolve Island Sampling Algorithm — TypeScript port of database/algorithms/island.py
 *
 * MAP-Elites-inspired island model for diversity-preserving exploration.
 * Maintains N islands, each evolving independently with periodic migration.
 * Feature dimensions map molecule properties (pIC50, MW, LogP) to archive cells.
 *
 * Source of truth: https://github.com/GAIR-NLP/ASI-Evolve/blob/main/database/algorithms/island.py
 */

import type { EvolveNode } from "./types";

// ─── Feature Dimensions (matches DEFAULT_ISLAND_FEATURE_DIMENSIONS in source) ─
export type FeatureDimension = "score" | "diversity" | "novelty";

export interface IslandConfig {
  numIslands: number;             // default 4 (matches source)
  migrationInterval: number;      // migrate every N generations (default 5)
  migrationSize: number;          // number of nodes to migrate (default 2)
  featureDimensions: FeatureDimension[]; // MAP-Elites feature axes
  featureBins: number;            // bins per dimension (default 10)
  explorationCoeff: number;       // UCB1 C for within-island selection (default 1.414)
}

const DEFAULT_CONFIG: IslandConfig = {
  numIslands: 4,
  migrationInterval: 5,
  migrationSize: 2,
  featureDimensions: ["score", "diversity"],
  featureBins: 10,
  explorationCoeff: 1.414,
};

// ─── Island State ─────────────────────────────────────────────────────────────

interface IslandState {
  id: number;
  nodeIds: Set<number>;
  generation: number;
  bestNodeId: number | null;
  // MAP-Elites feature map: feature_key → node_id
  featureMap: Map<string, number>;
}

// ─── IslandSampler ────────────────────────────────────────────────────────────

export class IslandSampler {
  private config: IslandConfig;
  private islands: IslandState[];
  private archive: Set<number>;
  private lastMigrationGeneration: number;
  private currentIsland: number;
  private diversityCache: Map<number, number>;

  constructor(config: Partial<IslandConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.islands = Array.from({ length: this.config.numIslands }, (_, i) => ({
      id: i,
      nodeIds: new Set(),
      generation: 0,
      bestNodeId: null,
      featureMap: new Map(),
    }));
    this.archive = new Set();
    this.lastMigrationGeneration = 0;
    this.currentIsland = 0;
    this.diversityCache = new Map();
  }

  /**
   * Assign a node to an island and update the feature map.
   * Mirrors IslandSampler._assign_to_island() from the Python source.
   */
  assignNode(node: EvolveNode): void {
    if (!node.id) return;

    // Assign to island based on node ID (round-robin for new nodes)
    const islandId = (node.id % this.config.numIslands);
    const island = this.islands[islandId];
    island.nodeIds.add(node.id);

    // Update best node for island
    if (
      island.bestNodeId === null ||
      (node.score || 0) > this._getNodeScore(island.bestNodeId, node)
    ) {
      island.bestNodeId = node.id;
    }

    // Update MAP-Elites feature map
    const featureCoords = this._calculateFeatureCoords(node);
    if (featureCoords) {
      const featureKey = featureCoords.join(",");
      const existing = island.featureMap.get(featureKey);
      if (!existing || (node.score || 0) > 0) {
        island.featureMap.set(featureKey, node.id);
      }
    }

    // Update archive if this is a high-scoring node
    if ((node.score || 0) > 0) {
      this.archive.add(node.id);
    }
  }

  /**
   * Sample n nodes using the island model.
   * Mirrors IslandSampler.sample() — selects from current island using UCB1,
   * then rotates to the next island.
   */
  sample(nodes: EvolveNode[], n: number): EvolveNode[] {
    if (nodes.length === 0) return [];
    n = Math.min(n, nodes.length);

    // Rebuild island membership from current nodes
    this._rebuildFromNodes(nodes);

    // Check if migration should occur
    const totalGeneration = this.islands.reduce((s, i) => s + i.generation, 0);
    if (
      totalGeneration - this.lastMigrationGeneration >= this.config.migrationInterval &&
      this.config.numIslands > 1
    ) {
      this._migrate(nodes);
      this.lastMigrationGeneration = totalGeneration;
    }

    // Select from current island using UCB1
    const island = this.islands[this.currentIsland];
    const islandNodes = nodes.filter((n) => n.id !== undefined && island.nodeIds.has(n.id!));

    let selected: EvolveNode[];
    if (islandNodes.length === 0) {
      // Island is empty — select from all nodes
      selected = this._ucb1Select(nodes, n);
    } else {
      selected = this._ucb1Select(islandNodes, n);
    }

    // Increment generation and rotate island
    island.generation++;
    this.currentIsland = (this.currentIsland + 1) % this.config.numIslands;

    // Increment visit counts
    for (const node of selected) {
      node.visit_count = (node.visit_count || 0) + 1;
    }

    return selected;
  }

  /**
   * Get statistics about all islands.
   * Mirrors IslandSampler.get_stats() from the Python source.
   */
  getStats(nodes: EvolveNode[]): object {
    const nodeMap = new Map(nodes.filter((n) => n.id !== undefined).map((n) => [n.id!, n]));
    return {
      num_islands: this.config.numIslands,
      archive_size: this.archive.size,
      total_generation: this.islands.reduce((s, i) => s + i.generation, 0),
      island_populations: this.islands.map((island) => {
        const islandNodes = Array.from(island.nodeIds)
          .map((id) => nodeMap.get(id))
          .filter(Boolean) as EvolveNode[];
        return {
          island_id: island.id,
          size: islandNodes.length,
          best_score: Math.max(...islandNodes.map((n) => n.score || 0), 0),
          avg_score:
            islandNodes.length > 0
              ? islandNodes.reduce((s, n) => s + (n.score || 0), 0) / islandNodes.length
              : 0,
          feature_map_coverage: island.featureMap.size,
        };
      }),
    };
  }

  /**
   * Get serializable state for persistence (run_state.py equivalent).
   * Captures currentIsland, lastMigrationGeneration, and per-island generation counts.
   */
  getSerializableState(): { currentIsland: number; lastMigrationGeneration: number; islandGenerations: number[] } {
    return {
      currentIsland: this.currentIsland,
      lastMigrationGeneration: this.lastMigrationGeneration,
      islandGenerations: this.islands.map((i) => i.generation),
    };
  }

  /**
   * Restore rotation state from a persisted snapshot.
   * Island membership is rebuilt from DB nodes on the next sample() call.
   */
  restoreState(state: { currentIsland: number; lastMigrationGeneration: number; islandGenerations: number[] }): void {
    this.currentIsland = state.currentIsland % this.config.numIslands;
    this.lastMigrationGeneration = state.lastMigrationGeneration;
    for (let i = 0; i < this.islands.length && i < state.islandGenerations.length; i++) {
      this.islands[i].generation = state.islandGenerations[i];
    }
  }

  /**
   * Reset transient state while keeping configuration.
   * Mirrors IslandSampler.reset() from the Python source.
   */
  reset(): void {
    this.islands = Array.from({ length: this.config.numIslands }, (_, i) => ({
      id: i,
      nodeIds: new Set(),
      generation: 0,
      bestNodeId: null,
      featureMap: new Map(),
    }));
    this.archive.clear();
    this.diversityCache.clear();
    this.lastMigrationGeneration = 0;
    this.currentIsland = 0;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _ucb1Select(nodes: EvolveNode[], n: number): EvolveNode[] {
    if (nodes.length === 0) return [];
    n = Math.min(n, nodes.length);

    const totalVisits = nodes.reduce((s, n) => s + (n.visit_count || 0), 0);
    if (totalVisits === 0) {
      // Random selection for unvisited nodes
      return this._shuffle([...nodes]).slice(0, n);
    }

    const scores = nodes.filter((n) => (n.visit_count || 0) > 0).map((n) => n.score || 0);
    if (scores.length === 0) return this._shuffle([...nodes]).slice(0, n);

    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore !== minScore ? maxScore - minScore : 1.0;

    const ucb1Values = nodes.map((node) => {
      if ((node.visit_count || 0) === 0) return { node, ucb1: Infinity };
      const normalizedScore = ((node.score || 0) - minScore) / scoreRange;
      const exploration =
        this.config.explorationCoeff *
        Math.sqrt(Math.log(totalVisits) / (node.visit_count || 1));
      return { node, ucb1: normalizedScore + exploration };
    });

    ucb1Values.sort((a, b) => b.ucb1 - a.ucb1);
    return ucb1Values.slice(0, n).map((x) => x.node);
  }

  private _migrate(nodes: EvolveNode[]): void {
    const nodeMap = new Map(nodes.filter((n) => n.id !== undefined).map((n) => [n.id!, n]));

    for (let i = 0; i < this.config.numIslands; i++) {
      const sourceIsland = this.islands[i];
      const targetIsland = this.islands[(i + 1) % this.config.numIslands];

      // Select best nodes from source island to migrate
      const sourceNodes = Array.from(sourceIsland.nodeIds)
        .map((id) => nodeMap.get(id))
        .filter(Boolean) as EvolveNode[];

      if (sourceNodes.length === 0) continue;

      const migrants = sourceNodes
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, this.config.migrationSize);

      for (const migrant of migrants) {
        if (migrant.id !== undefined) {
          targetIsland.nodeIds.add(migrant.id);
        }
      }
    }
  }

  private _calculateFeatureCoords(node: EvolveNode): number[] | null {
    if (this.config.featureDimensions.length === 0) return null;

    const coords: number[] = [];
    for (const dim of this.config.featureDimensions) {
      let value: number;
      if (dim === "score") {
        value = node.score || 0;
      } else if (dim === "diversity") {
        value = this.diversityCache.get(node.id || 0) || Math.random();
      } else {
        value = Math.random();
      }
      // Bin the value into [0, featureBins)
      const binned = Math.min(
        Math.floor(value * this.config.featureBins),
        this.config.featureBins - 1
      );
      coords.push(Math.max(0, binned));
    }
    return coords;
  }

  private _rebuildFromNodes(nodes: EvolveNode[]): void {
    // Reset island membership
    for (const island of this.islands) {
      island.nodeIds.clear();
      island.featureMap.clear();
    }

    for (const node of nodes) {
      if (node.id === undefined) continue;
      const islandId = node.id % this.config.numIslands;
      this.islands[islandId].nodeIds.add(node.id);
    }
  }

  private _getNodeScore(nodeId: number, fallbackNode: EvolveNode): number {
    if (fallbackNode.id === nodeId) return fallbackNode.score || 0;
    return 0;
  }

  private _shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ─── Sampler factory (matches sampling_config.py) ────────────────────────────

export type SamplerAlgorithm = "ucb1" | "greedy" | "random" | "island";

export interface SamplerConfig {
  algorithm: SamplerAlgorithm;
  sampleN: number;
  explorationCoeff?: number;
  numIslands?: number;
  migrationInterval?: number;
  featureDimensions?: FeatureDimension[];
  featureBins?: number;
}

/**
 * Create a sampler from config.
 * Mirrors sampling_config.py create_sampler() from the Python source.
 */
export function createSampler(config: SamplerConfig) {
  switch (config.algorithm) {
    case "island":
      return new IslandSampler({
        numIslands: config.numIslands || 4,
        migrationInterval: config.migrationInterval || 5,
        explorationCoeff: config.explorationCoeff || 1.414,
        featureDimensions: config.featureDimensions || ["score", "diversity"],
        featureBins: config.featureBins || 10,
        migrationSize: 2,
      });
    default:
      // UCB1, greedy, random are handled inline in database.ts
      return null;
  }
}
