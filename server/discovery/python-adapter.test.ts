/**
 * python-adapter.test.ts — Unit tests for the unified 65-source registry
 */

import { describe, it, expect } from "vitest";
import {
  getAllSources,
  getPythonOnlySources,
  getSourcesByDomain,
  getQuantumEligibleSources,
} from "./python-adapter";

describe("python-adapter source registry", () => {
  it("getAllSources returns exactly 65 sources", () => {
    const sources = getAllSources();
    expect(sources).toHaveLength(65);
  });

  it("getPythonOnlySources returns exactly 50 python-only sources", () => {
    const pythonSources = getPythonOnlySources();
    expect(pythonSources).toHaveLength(50);
    // All returned sources must be python adapter type
    pythonSources.forEach(s => {
      expect(s.adapterType).toBe("python");
      expect(s.isNative).toBe(false);
    });
  });

  it("getSourcesByDomain filters correctly for molecular domain", () => {
    const molecular = getSourcesByDomain("molecular");
    expect(molecular.length).toBeGreaterThan(0);
    molecular.forEach(s => {
      expect(s.domain).toBe("molecular");
    });
    // PubChem, ChEMBL, BindingDB, DrugBank, hivprotease, nist, moleculardiscovery should be in molecular
    const ids = molecular.map(s => s.id);
    expect(ids).toContain("pubchem");
    expect(ids).toContain("chembl");
    expect(ids).toContain("bindingdb");
  });

  it("getQuantumEligibleSources returns only sources with isQuantumEligible=true", () => {
    const quantumSources = getQuantumEligibleSources();
    expect(quantumSources.length).toBeGreaterThan(0);
    quantumSources.forEach(s => {
      expect(s.isQuantumEligible).toBe(true);
    });
    // Wukong VQE and PubChem must be quantum eligible
    const ids = quantumSources.map(s => s.id);
    expect(ids).toContain("wukong_vqe");
    expect(ids).toContain("pubchem");
  });
});
