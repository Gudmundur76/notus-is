import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Download, ChevronDown, ChevronUp, ExternalLink, FlaskConical } from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const TRACK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  TC: { color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  TB: { color: "#06B6D4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.3)" },
  TA: { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)" },
  TD: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
};

const candidates = [
  {
    id: "REF-001",
    name: "Darunavir (Reference)",
    track: "TC",
    trackLabel: "Reference",
    picso: 9.50,
    confidence: 0.99,
    smiles: "O=C(N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)OC1CO1)c1ccc2c(c1)CCO2",
    scaffold: "Hydroxyethylamine",
    sources: ["ChEMBL", "PDB:1HSG", "BindingDB"],
    pmids: ["41476560", "40446126", "39697065"],
    convergent: false,
    day: 0,
  },
  {
    id: "CYC1-TB-001",
    name: "Track B Candidate #1",
    track: "TB",
    trackLabel: "PDB Co-Crystal",
    picso: 8.77,
    confidence: 0.88,
    smiles: "CC(C)(C)NC(=O)[C@@H]1C[C@@H]2CCCC[C@@H]2N1Cc1ccc(-c2ccccc2)c...truncated",
    scaffold: "Cyclic urea",
    sources: ["PDB:1HXB", "ChEMBL"],
    pmids: ["42284336", "42277426"],
    convergent: false,
    day: 1,
  },
  {
    id: "CYC1-TC-001",
    name: "Track C Candidate #1",
    track: "TC",
    trackLabel: "BindingDB",
    picso: 9.11,
    confidence: 0.92,
    smiles: "O=C(N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccc(F)cc1)NC(=O)OC...truncated",
    scaffold: "Bis-THF",
    sources: ["BindingDB", "ChEMBL"],
    pmids: ["42274498", "42284336"],
    convergent: false,
    day: 1,
  },
];

function CandidateCard({ candidate, index }: { candidate: typeof candidates[0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const tc = TRACK_COLORS[candidate.track] || TRACK_COLORS.TC;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: easeOutExpo }}
      className="candidate-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="track-badge"
              style={{ backgroundColor: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}
            >
              {candidate.track}
            </span>
            <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 700, color: "#F0F4F8" }}>
              {candidate.name}
            </h3>
            {candidate.convergent && (
              <span
                className="track-badge"
                style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}
              >
                ⚡ CONVERGENT
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 mb-3">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#64748B" }}>
              Scaffold: <span style={{ color: "#94A3B8" }}>{candidate.scaffold}</span>
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#64748B" }}>
              Day: <span style={{ color: "#94A3B8" }}>{candidate.day}</span>
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#64748B" }}>
              ID: <span style={{ color: "#94A3B8" }}>{candidate.id}</span>
            </span>
          </div>
          <p
            className="truncate"
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B", maxWidth: 480 }}
          >
            {candidate.smiles}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: tc.color, lineHeight: 1 }}>
            {candidate.picso.toFixed(2)}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "#64748B" }}>pIC₅₀</div>
          <div
            className="track-badge"
            style={{ backgroundColor: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}
          >
            {Math.round(candidate.confidence * 100)}% conf
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ color: "#64748B", marginTop: 4, transition: "color 0.2s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#F0F4F8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.3, ease: easeOutExpo }}
          className="mt-4 pt-4"
          style={{ borderTop: "1px solid #1E2D47" }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B", marginBottom: 6 }}>SMILES</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#94A3B8", wordBreak: "break-all", lineHeight: 1.6 }}>
                {candidate.smiles}
              </p>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B", marginBottom: 6 }}>CITATION EVIDENCE</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {candidate.pmids.map((pmid) => (
                  <a
                    key={pmid}
                    href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors"
                    style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontFamily: "var(--font-mono)", fontSize: 11, color: "#10B981" }}
                  >
                    PMID:{pmid} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B", marginBottom: 4 }}>SOURCES</p>
              <div className="flex flex-wrap gap-2">
                {candidate.sources.map((src) => (
                  <span
                    key={src}
                    className="rounded-md px-2 py-1"
                    style={{ backgroundColor: "#1E2D47", fontFamily: "var(--font-mono)", fontSize: 11, color: "#94A3B8" }}
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function Findings() {
  const [activeTrack, setActiveTrack] = useState("All");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5% 0px" });

  const tracks = ["All", "Track A", "Track B", "Track C", "Track D"];
  const filtered = activeTrack === "All" ? candidates : candidates.filter((c) => {
    const map: Record<string, string> = { "Track A": "TA", "Track B": "TB", "Track C": "TC", "Track D": "TD" };
    return c.track === map[activeTrack];
  });

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
            {'// DISCOVERY FINDINGS'}
          </motion.span>
          <motion.h1
            initial={{ y: 40, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.7, ease: easeOutExpo }}
            className="mt-4"
            style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 700, color: "#F0F4F8", letterSpacing: "-2px" }}
          >
            Verified <span style={{ color: "#10B981" }}>Candidates</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
            className="mt-4 max-w-[600px]"
            style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "#94A3B8", lineHeight: 1.7 }}
          >
            All candidates listed here have passed ensemble consensus scoring (std ≤ 0.3 pIC₅₀) and citation verification (confidence ≥ 0.85). The corpus grows with each micro-loop cycle.
          </motion.p>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: "1px solid #1E2D47", borderBottom: "1px solid #1E2D47", backgroundColor: "#141E33" }}>
        <div className="mx-auto max-w-[1280px] container-padding py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Corpus Records", value: "44", color: "#10B981", icon: FlaskConical },
              { label: "Verified Candidates", value: "3", color: "#06B6D4", icon: FlaskConical },
              { label: "Convergent (2+ tracks)", value: "0", color: "#8B5CF6", icon: FlaskConical },
              { label: "Mean Confidence", value: "93%", color: "#F59E0B", icon: FlaskConical },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ y: 20, opacity: 0 }}
                animate={isInView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * i, ease: easeOutExpo }}
                className="flex items-center gap-4"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <stat.icon size={18} style={{ color: stat.color }} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "#F0F4F8" }}>{stat.value}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#64748B" }}>{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Candidates */}
      <section className="py-12">
        <div className="mx-auto max-w-[1280px] container-padding">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex flex-wrap gap-2">
              {tracks.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTrack(t)}
                  className="rounded-full px-4 py-2 transition-all"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    fontWeight: 500,
                    backgroundColor: activeTrack === t ? "#10B981" : "#1E2D47",
                    color: activeTrack === t ? "#0A0F1C" : "#94A3B8",
                    border: activeTrack === t ? "1px solid #10B981" : "1px solid #1E2D47",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 transition-all"
              style={{ border: "1px solid #1E2D47", fontFamily: "var(--font-body)", fontSize: 13, color: "#94A3B8" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#10B981"; (e.currentTarget as HTMLElement).style.color = "#10B981"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1E2D47"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-4">
            {filtered.map((c, i) => <CandidateCard key={c.id} candidate={c} index={i} />)}
          </div>

          {/* Day 30 callout */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4, ease: easeOutExpo }}
            className="mt-10 rounded-2xl p-8"
            style={{ border: "1px solid rgba(16,185,129,0.2)", backgroundColor: "rgba(16,185,129,0.05)" }}
          >
            <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 22, fontWeight: 700, color: "#10B981", marginBottom: 8 }}>
              Day 30 Scientific Finding
            </h3>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "#94A3B8", lineHeight: 1.7, maxWidth: 640 }}>
              At day 30, the top convergence candidates — molecules appearing in 2 or more tracks with confidence ≥ 0.92 — will be compiled into a 15–20 page scientific document following IUPAC and JACS formatting standards. The document will be published here and submitted to bioRxiv under CC BY 4.0.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
