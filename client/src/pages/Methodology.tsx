import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Database, GitBranch, Zap, Shield, Target, BarChart3, ExternalLink } from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const steps = [
  {
    num: "01", icon: Database, color: "#10B981",
    title: "Seed Corpus Construction",
    desc: "39 curated HIV protease inhibitor records assembled from ChEMBL (CHEMBL2094253 target), RCSB PDB co-crystal structures (1HSG, 1HXB, 2BPX, 1HHP, 1KJF, 1OHR, 1SBG, 2FLE), and BindingDB. Each record carries a confidence score derived from cross-source agreement. Mean corpus confidence: 0.935.",
    details: ["ChEMBL bioactivity assay IC₅₀ values", "PDB co-crystal ligand coordinates", "BindingDB curated measurements", "8 PDB ground truth structures"],
  },
  {
    num: "02", icon: GitBranch, color: "#06B6D4",
    title: "4-Track Parallel Generation",
    desc: "Each cycle generates 50 candidates per track using scaffold-aware mutation via RDKit. Track A seeds from ChEMBL top actives (hydroxyethylamine scaffold). Track B seeds from PDB co-crystal ligands (structure-guided P2/P2' modifications). Track C seeds from BindingDB curated records (bis-THF and carbamate variants). Track D explores novel scaffolds with low Tanimoto similarity to approved drugs.",
    details: ["50 candidates × 4 tracks = 200 per cycle", "RDKit scaffold mutation", "Tanimoto diversity filter", "Lipinski Rule-of-5 pre-filter"],
  },
  {
    num: "03", icon: Zap, color: "#8B5CF6",
    title: "Ensemble Consensus Scoring",
    desc: "A 10-model ensemble (Random Forest, Gradient Boosting, Ridge, Lasso, ElasticNet, SVR, ExtraTrees, AdaBoost, BaggingRegressor, HistGradientBoosting) trained on Morgan fingerprints (radius=2, 2048 bits) and RDKit descriptors. Consensus threshold: ensemble standard deviation ≤ 0.3 pIC₅₀. 138 of 150 candidates passed in cycle 1.",
    details: ["10 sklearn models", "Morgan fingerprints + RDKit descriptors", "Consensus std threshold ≤ 0.3 pIC₅₀", "UCB1 exploration-exploitation balance"],
  },
  {
    num: "04", icon: Shield, color: "#F59E0B",
    title: "Citation Verification",
    desc: "All candidates above consensus threshold are submitted to the citation.manus.space verification API — the live ttruthdesk-platform production endpoint. The 8-stage pipeline runs: extract → entity resolve → PDB validate → PubMed cross-reference → UniProt lookup → friction interrogation → completeness gate → composite truth score. Candidates with verdict 'Supported' and confidence ≥ 0.85 enter the corpus.",
    details: ["8-stage ttruthdesk pipeline", "PubMed, PDB, UniProt cross-reference", "SPO triple extraction", "Contradiction detection"],
  },
  {
    num: "05", icon: Target, color: "#10B981",
    title: "Convergence Analysis (Day 7+)",
    desc: "From day 7, cross-track consensus analysis activates. Molecules with Tanimoto similarity ≥ 0.7 appearing in 2 or more tracks are flagged as convergence candidates. These are the highest-priority molecules — independently discovered by multiple tracks, implying structural robustness. Convergence candidates receive additional verification cycles.",
    details: ["Tanimoto ≥ 0.7 cross-track match", "Activates day 7", "Priority re-verification", "Scaffold family clustering"],
  },
  {
    num: "06", icon: BarChart3, color: "#06B6D4",
    title: "Day-30 Scientific Publication",
    desc: "The top 4–8 convergence candidates are compiled into a 15–20 page scientific document following IUPAC and JACS formatting standards. The document includes: molecular structures, predicted pIC₅₀ values with confidence intervals, scaffold analysis, comparison to approved HIV PIs, citation evidence, and limitations. Published on bioRxiv under CC BY 4.0.",
    details: ["IUPAC + JACS formatting", "4–8 convergence candidates", "bioRxiv submission", "CC BY 4.0 license"],
  },
];

const techStack = [
  { name: "novus-is", desc: "Generation engine — RDKit, sklearn, 4-track micro-loop", url: "https://github.com/Gudmundur76/novus-is" },
  { name: "citation.manus.space", desc: "Verification backend — ttruthdesk-platform, 8-stage pipeline", url: "https://citation.manus.space" },
  { name: "ASI-Evolve", desc: "UCB1 exploration strategy, cognition store", url: "https://github.com/GAIR-NLP/ASI-Evolve" },
  { name: "notus-is", desc: "Publication frontend — React, Tailwind, Manus webdev", url: "https://github.com/Gudmundur76/notus-is" },
];

export default function Methodology() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5% 0px" });

  return (
    <div ref={ref} className="bg-deep-space min-h-screen">
      {/* Hero */}
      <section className="relative py-24 lg:py-32 hero-mesh">
        <div className="mx-auto max-w-[1280px] container-padding">
          <motion.span
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            className="section-label"
          >
            {'// METHODOLOGY'}
          </motion.span>
          <motion.h1
            initial={{ y: 40, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.7, ease: easeOutExpo }}
            className="mt-4"
            style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 700, color: "#F0F4F8", letterSpacing: "-2px" }}
          >
            How the <span style={{ color: "#10B981" }}>Engine Works</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
            className="mt-4 max-w-[640px]"
            style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "#94A3B8", lineHeight: 1.7 }}
          >
            notus.is is a fully autonomous discovery system. It runs daily micro-loop cycles, generates candidates, scores them against a 10-model ensemble, verifies claims against the ttruthdesk knowledge graph, and accumulates verified records. No human intervention between cycles.
          </motion.p>
        </div>
      </section>

      {/* Pipeline steps */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: "#0D1425" }}>
        <div className="mx-auto max-w-[1280px] container-padding">
          <div className="flex flex-col gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  initial={{ x: -30, opacity: 0 }}
                  animate={isInView ? { x: 0, opacity: 1 } : {}}
                  transition={{ duration: 0.6, delay: 0.1 * i, ease: easeOutExpo }}
                  className="step-card grid grid-cols-1 lg:grid-cols-[80px_1fr] gap-6 items-start"
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${step.color}15`, border: `1px solid ${step.color}30` }}
                  >
                    <Icon size={26} style={{ color: step.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#64748B" }}>{step.num}</span>
                      <h3 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(18px, 2vw, 24px)", fontWeight: 700, color: "#F0F4F8" }}>
                        {step.title}
                      </h3>
                    </div>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "#94A3B8", lineHeight: 1.7, maxWidth: 640, marginBottom: 12 }}>
                      {step.desc}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {step.details.map((d) => (
                        <span
                          key={d}
                          className="rounded-md px-3 py-1"
                          style={{ backgroundColor: "#1E2D47", fontFamily: "var(--font-mono)", fontSize: 11, color: "#94A3B8" }}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: "#0A0F1C" }}>
        <div className="mx-auto max-w-[1280px] container-padding">
          <motion.span
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            className="section-label"
          >
            {'// TECHNOLOGY STACK'}
          </motion.span>
          <motion.h2
            initial={{ y: 40, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.7, ease: easeOutExpo }}
            className="mt-4 mb-10"
            style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(28px, 3vw, 44px)", fontWeight: 700, color: "#F0F4F8", letterSpacing: "-1px" }}
          >
            Built on <span style={{ color: "#10B981" }}>Production Systems</span>
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-4">
            {techStack.map((tech, i) => (
              <motion.a
                key={tech.name}
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ y: 20, opacity: 0 }}
                animate={isInView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * i, ease: easeOutExpo }}
                className="candidate-card flex items-start justify-between gap-4 group"
              >
                <div>
                  <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 700, color: "#10B981", marginBottom: 6 }}>
                    {tech.name}
                  </h3>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8" }}>{tech.desc}</p>
                </div>
                <ExternalLink size={16} style={{ color: "#64748B", flexShrink: 0, transition: "color 0.2s" }} className="group-hover:text-bio-teal" />
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section className="py-12 pb-24" style={{ backgroundColor: "#0D1425" }}>
        <div className="mx-auto max-w-[1280px] container-padding">
          <div
            className="rounded-2xl p-8"
            style={{ border: "1px solid rgba(245,158,11,0.2)", backgroundColor: "rgba(245,158,11,0.04)" }}
          >
            <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 700, color: "#F59E0B", marginBottom: 12 }}>
              Limitations and Scope
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                "Computational predictions only — no wet lab validation. pIC₅₀ values are model predictions, not experimental measurements.",
                "Ensemble trained on 39 seed records. Cross-validation R² is negative at this corpus size. Improves significantly above 200 records.",
                "No ADMET filtering in cycle 1. Toxicity, solubility, and bioavailability are not assessed in the current pipeline.",
                "HIV-1 protease only. Does not address resistance mutations (V82A, I84V, L90M) or HIV-2 protease.",
              ].map((text, i) => (
                <div key={i} className="flex gap-3">
                  <span style={{ color: "#F59E0B", flexShrink: 0, marginTop: 2, fontSize: 14 }}>⚠</span>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
