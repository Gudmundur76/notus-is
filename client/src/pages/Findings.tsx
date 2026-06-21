import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, BarChart3, Dna, Download, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number];
const TEAL = "oklch(0.72 0.17 162)";
const CYAN = "oklch(0.70 0.15 200)";
const VIOLET = "oklch(0.60 0.22 290)";
const AMBER = "oklch(0.78 0.17 80)";

interface Candidate {
  id: string;
  name: string;
  smiles: string;
  pic50: number;
  confidence: number;
  tracks: string[];
  scaffold: string;
  novelty: number;
  day: number;
  verdict: string;
}

const SEED_CANDIDATES: Candidate[] = [
  {
    id: "mol_000000",
    name: "Darunavir (Reference)",
    smiles: "O=C(N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)OC1COC2CCOC12)c1ccc(N)cc1",
    pic50: 9.5,
    confidence: 0.99,
    tracks: ["C"],
    scaffold: "bis_thf",
    novelty: 0.0,
    day: 1,
    verdict: "Strongly Supported",
  },
  {
    id: "mol_track_b_001",
    name: "Track B Candidate #1",
    smiles: "CC(C)(C)NC(=O)[C@@H]1C[C@@H]2CCCC[C@@H]2N1Cc1ccc(-c2ccccc2)cc1",
    pic50: 8.77,
    confidence: 0.88,
    tracks: ["B"],
    scaffold: "pdb_cocrystal",
    novelty: 0.42,
    day: 1,
    verdict: "Supported",
  },
  {
    id: "mol_track_c_001",
    name: "Track C Candidate #1",
    smiles: "O=C(N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccc(F)cc1)NC(=O)OC1COC2CCOC12)c1ccc(N)cc1",
    pic50: 9.11,
    confidence: 0.92,
    tracks: ["C"],
    scaffold: "bis_thf",
    novelty: 0.18,
    day: 1,
    verdict: "Strongly Supported",
  },
];

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.95
      ? `color: ${TEAL}; border-color: oklch(0.72 0.17 162 / 0.3); background-color: oklch(0.72 0.17 162 / 0.1)`
      : confidence >= 0.85
      ? `color: ${CYAN}; border-color: oklch(0.70 0.15 200 / 0.3); background-color: oklch(0.70 0.15 200 / 0.1)`
      : `color: ${AMBER}; border-color: oklch(0.78 0.17 80 / 0.3); background-color: oklch(0.78 0.17 80 / 0.1)`;
  return (
    <span className="font-mono text-xs border rounded px-2 py-0.5" style={{ cssText: color } as React.CSSProperties}>
      {(confidence * 100).toFixed(0)}%
    </span>
  );
}

function TrackBadge({ track }: { track: string }) {
  const colors: Record<string, string> = { A: TEAL, B: CYAN, C: VIOLET, D: AMBER };
  const c = colors[track] || "oklch(0.60 0.010 260)";
  return (
    <span className="font-mono text-xs rounded px-1.5 py-0.5"
      style={{ color: c, backgroundColor: `${c.replace(")", " / 0.1)")}` }}>
      T{track}
    </span>
  );
}

function CandidateRow({ candidate }: { candidate: Candidate }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "oklch(0.22 0.012 260)" }}>
      <button className="w-full flex items-center gap-4 p-4 hover:bg-[oklch(0.18_0.015_260/0.5)] transition-colors text-left"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-headline)" }}>{candidate.name}</span>
            {candidate.tracks.map((t) => <TrackBadge key={t} track={t} />)}
            <ConfidenceBadge confidence={candidate.confidence} />
          </div>
          <div className="font-mono text-xs text-muted-foreground truncate">{candidate.smiles.slice(0, 60)}...</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold" style={{ color: TEAL, fontFamily: "var(--font-headline)" }}>{candidate.pic50.toFixed(2)}</div>
          <div className="font-mono text-xs text-muted-foreground">pIC₅₀</div>
        </div>
        <div className="text-muted-foreground">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {expanded && (
        <div className="border-t p-4" style={{ borderColor: "oklch(0.22 0.012 260)", backgroundColor: "oklch(0.14 0.015 260 / 0.3)" }}>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="font-mono text-xs text-muted-foreground mb-1">SCAFFOLD FAMILY</div>
              <div className="text-sm text-foreground capitalize">{candidate.scaffold.replace("_", " ")}</div>
            </div>
            <div>
              <div className="font-mono text-xs text-muted-foreground mb-1">STRUCTURAL NOVELTY</div>
              <div className="text-sm text-foreground">{(candidate.novelty * 100).toFixed(0)}% from approved drugs</div>
            </div>
            <div>
              <div className="font-mono text-xs text-muted-foreground mb-1">CITATION VERDICT</div>
              <div className="text-sm" style={{ color: TEAL }}>{candidate.verdict}</div>
            </div>
          </div>
          <div>
            <div className="font-mono text-xs text-muted-foreground mb-1">FULL SMILES</div>
            <div className="font-mono text-xs text-muted-foreground rounded p-2 break-all"
              style={{ backgroundColor: "oklch(0.12 0.015 260)" }}>
              {candidate.smiles}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <a href={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(candidate.smiles)}/JSON`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: TEAL }}>
              PubChem lookup <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Findings() {
  const [filter, setFilter] = useState<"all" | "A" | "B" | "C" | "D">("all");
  const filtered = filter === "all" ? SEED_CANDIDATES : SEED_CANDIDATES.filter((c) => c.tracks.includes(filter));

  return (
    <main className="pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }} className="mb-12">
          <span className="section-label">DISCOVERY FINDINGS</span>
          <h1 className="text-4xl font-bold text-foreground mt-2 mb-4" style={{ fontFamily: "var(--font-headline)" }}>Verified Candidates</h1>
          <p className="text-muted-foreground max-w-2xl">
            All candidates listed here have passed ensemble consensus scoring (std ≤ 0.3 pIC₅₀) and citation verification (confidence ≥ 0.85). The corpus grows with each micro-loop cycle.
          </p>
        </motion.div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Corpus Records", value: 44, icon: Dna, color: TEAL },
            { label: "Verified Candidates", value: SEED_CANDIDATES.length, icon: Shield, color: CYAN },
            { label: "Convergent (2+ tracks)", value: 0, icon: BarChart3, color: VIOLET },
            { label: "Mean Confidence", value: "93%", icon: Shield, color: AMBER },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border p-4" style={{ borderColor: "oklch(0.22 0.012 260)", backgroundColor: "oklch(0.14 0.015 260 / 0.5)" }}>
              <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: "var(--font-headline)" }}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Track filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground">Filter by track:</span>
          {(["all", "A", "B", "C", "D"] as const).map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className="font-mono text-xs px-3 py-1 rounded border transition-colors"
              style={filter === t
                ? { borderColor: TEAL, color: TEAL, backgroundColor: "oklch(0.72 0.17 162 / 0.1)" }
                : { borderColor: "oklch(0.22 0.012 260)", color: "oklch(0.60 0.010 260)" }}>
              {t === "all" ? "All" : `Track ${t}`}
            </button>
          ))}
          <button className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-muted-foreground border rounded px-3 py-1"
            style={{ borderColor: "oklch(0.22 0.012 260)" }}>
            <Download size={12} /> Export CSV
          </button>
        </div>

        {/* Candidate list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No candidates yet for this track. The engine is running.</div>
          ) : (
            filtered.map((c) => <CandidateRow key={c.id} candidate={c} />)
          )}
        </div>

        {/* Day 30 note */}
        <div className="mt-12 rounded-xl border p-6" style={{ borderColor: "oklch(0.72 0.17 162 / 0.2)", backgroundColor: "oklch(0.72 0.17 162 / 0.05)" }}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: TEAL, fontFamily: "var(--font-headline)" }}>Day 30 Scientific Finding</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            At day 30, the top convergence candidates — molecules appearing in 2 or more tracks with confidence ≥ 0.92 — will be compiled into a 15–20 page scientific document following IUPAC and JACS formatting standards. The document will be published here and submitted to bioRxiv under CC BY 4.0.
          </p>
        </div>
      </div>
    </main>
  );
}
