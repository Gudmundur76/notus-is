import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Download, ExternalLink, FlaskConical, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const TRACK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  A: { color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  B: { color: "#06B6D4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.3)" },
  C: { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)" },
  D: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
};

const TRACK_LABELS: Record<string, string> = {
  A: "ChEMBL Top Actives",
  B: "PDB Co-Crystal",
  C: "BindingDB Curated",
  D: "Diverse Scaffolds",
};

function CandidateCard({ candidate, index }: { candidate: {
  id: number;
  smiles: string;
  track: string;
  pic50Predicted: number;
  confidenceScore: number;
  citationGatePassed: boolean;
  quantumHardware: string;
  quantumScore: number;
  mw: number | null;
  logp: number | null;
  tpsa: number | null;
  isNovel: boolean;
  isBestSoFar: boolean;
  createdAt: Date;
}; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const tc = TRACK_COLORS[candidate.track] ?? TRACK_COLORS.A;

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: easeOutExpo }}
      className="rounded-2xl p-6 cursor-pointer"
      style={{ backgroundColor: tc.bg, border: `1px solid ${tc.border}` }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-mono font-bold"
              style={{ backgroundColor: `${tc.color}20`, color: tc.color, border: `1px solid ${tc.border}` }}
            >
              Track {candidate.track}
            </span>
            <span className="text-xs font-mono" style={{ color: "#64748B" }}>
              {TRACK_LABELS[candidate.track]}
            </span>
            {candidate.citationGatePassed && (
              <span className="rounded-full px-2 py-0.5 text-xs font-mono" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}>
                VERIFIED
              </span>
            )}
            {candidate.isBestSoFar && (
              <span className="rounded-full px-2 py-0.5 text-xs font-mono" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}>
                BEST
              </span>
            )}
            {candidate.isNovel && (
              <span className="rounded-full px-2 py-0.5 text-xs font-mono" style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.2)" }}>
                NOVEL
              </span>
            )}
          </div>

          <div className="font-mono text-xs truncate mb-3" style={{ color: "#94A3B8" }}>
            {candidate.smiles.substring(0, 60)}{candidate.smiles.length > 60 ? "..." : ""}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-xs font-mono mb-0.5" style={{ color: "#64748B" }}>pIC50</div>
              <div className="text-xl font-bold font-mono" style={{ color: tc.color }}>
                {candidate.pic50Predicted.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs font-mono mb-0.5" style={{ color: "#64748B" }}>Confidence</div>
              <div className="text-xl font-bold font-mono" style={{ color: "#F0F4F8" }}>
                {(candidate.confidenceScore * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs font-mono mb-0.5" style={{ color: "#64748B" }}>Quantum</div>
              <div className="text-xl font-bold font-mono" style={{ color: "#06B6D4" }}>
                {(candidate.quantumScore * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs font-mono mb-0.5" style={{ color: "#64748B" }}>Hardware</div>
              <div className="text-sm font-mono" style={{ color: "#94A3B8" }}>
                {candidate.quantumHardware || "Classical"}
              </div>
            </div>
          </div>
        </div>

        <button className="mt-1 flex-shrink-0" style={{ color: "#64748B" }}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.3, ease: easeOutExpo }}
          className="mt-4 pt-4 overflow-hidden"
          style={{ borderTop: `1px solid ${tc.border}` }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            {candidate.mw !== null && (
              <div>
                <div className="text-xs font-mono mb-0.5" style={{ color: "#64748B" }}>MW</div>
                <div className="text-sm font-mono" style={{ color: "#F0F4F8" }}>{candidate.mw?.toFixed(1)} g/mol</div>
              </div>
            )}
            {candidate.logp !== null && (
              <div>
                <div className="text-xs font-mono mb-0.5" style={{ color: "#64748B" }}>LogP</div>
                <div className="text-sm font-mono" style={{ color: "#F0F4F8" }}>{candidate.logp?.toFixed(2)}</div>
              </div>
            )}
            {candidate.tpsa !== null && (
              <div>
                <div className="text-xs font-mono mb-0.5" style={{ color: "#64748B" }}>TPSA</div>
                <div className="text-sm font-mono" style={{ color: "#F0F4F8" }}>{candidate.tpsa?.toFixed(1)} A^2</div>
              </div>
            )}
          </div>

          <div className="mb-3">
            <div className="text-xs font-mono mb-1" style={{ color: "#64748B" }}>SMILES</div>
            <div
              className="text-xs font-mono p-2 rounded-lg break-all"
              style={{ backgroundColor: "rgba(0,0,0,0.3)", color: "#94A3B8" }}
            >
              {candidate.smiles}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <a
              href={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(candidate.smiles)}/JSON`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={12} /> PubChem
            </a>
            <a
              href={`https://www.ebi.ac.uk/chembl/compound_report_card/${encodeURIComponent(candidate.smiles)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "rgba(6,182,212,0.1)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={12} /> ChEMBL
            </a>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function Findings() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5% 0px" });

  const [page, setPage] = useState(1);
  const [track, setTrack] = useState<"A" | "B" | "C" | "D" | undefined>(undefined);
  const [minPic50, setMinPic50] = useState(7.5);
  const [citationOnly, setCitationOnly] = useState(false);

  const { data, isLoading, error, refetch } = trpc.discovery.candidates.useQuery({
    page,
    pageSize: 20,
    track,
    minPic50,
    citationGatePassed: citationOnly ? true : undefined,
    sortBy: "pic50",
    sortDir: "desc",
  });

  const { data: stats } = trpc.discovery.stats.useQuery();

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div ref={ref} className="min-h-screen" style={{ backgroundColor: "#0A0F1C" }}>
      <div className="mx-auto max-w-[1280px] container-padding py-24">
        {/* Header */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="mb-12"
        >
          <span className="section-label">// DISCOVERY FINDINGS</span>
          <h1
            className="mt-4 mb-4"
            style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(32px, 4vw, 56px)", fontWeight: 700, color: "#F0F4F8", letterSpacing: "-1.5px" }}
          >
            Candidate <span style={{ color: "#10B981" }}>Library</span>
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "#94A3B8", lineHeight: 1.7, maxWidth: 560 }}>
            All molecules generated and scored by the autonomous discovery engine. Verified candidates have passed the 8-stage citation gate.
          </p>

          {stats && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Candidates", value: stats.totalCandidates.toLocaleString(), color: "#10B981" },
                { label: "Best pIC50", value: stats.bestPic50 > 0 ? stats.bestPic50.toFixed(2) : "—", color: "#06B6D4" },
                { label: "Day", value: `${stats.dayNumber} / 30`, color: "#8B5CF6" },
                { label: "Cycles Run", value: stats.totalCycles.toLocaleString(), color: "#F59E0B" },
              ].map(stat => (
                <div key={stat.label} className="stat-card">
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#64748B", marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
          className="mb-8 flex flex-wrap gap-3 items-center"
        >
          <div className="flex gap-2">
            {(["A", "B", "C", "D"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTrack(track === t ? undefined : t)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                style={{
                  backgroundColor: track === t ? `${TRACK_COLORS[t].color}20` : "rgba(255,255,255,0.05)",
                  color: track === t ? TRACK_COLORS[t].color : "#64748B",
                  border: `1px solid ${track === t ? TRACK_COLORS[t].border : "rgba(255,255,255,0.1)"}`,
                }}
              >
                Track {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono" style={{ color: "#64748B" }}>Min pIC50:</span>
            <select
              value={minPic50}
              onChange={e => { setMinPic50(Number(e.target.value)); setPage(1); }}
              className="text-xs font-mono px-2 py-1.5 rounded-lg"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#F0F4F8", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {[6.0, 7.0, 7.5, 8.0, 8.5, 9.0].map(v => (
                <option key={v} value={v}>{v.toFixed(1)}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => { setCitationOnly(c => !c); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
            style={{
              backgroundColor: citationOnly ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
              color: citationOnly ? "#10B981" : "#64748B",
              border: `1px solid ${citationOnly ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            Verified Only
          </button>

          <button
            onClick={() => refetch()}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
            style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#64748B", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </motion.div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="live-dot" style={{ width: 12, height: 12 }} />
              <span className="text-sm font-mono" style={{ color: "#64748B" }}>Loading candidates...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle size={32} style={{ color: "#EF4444" }} />
              <span className="text-sm font-mono" style={{ color: "#EF4444" }}>Failed to load candidates</span>
              <button
                onClick={() => refetch()}
                className="text-xs font-mono px-4 py-2 rounded-lg"
                style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <FlaskConical size={48} style={{ color: "#1E2D47" }} />
            <div className="text-center">
              <div className="font-mono text-sm mb-2" style={{ color: "#64748B" }}>No candidates yet</div>
              <div className="font-mono text-xs" style={{ color: "#475569" }}>
                The discovery loop will generate candidates on the next cycle.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-mono" style={{ color: "#64748B" }}>
                {data?.total.toLocaleString()} candidates
              </span>
              <span className="text-xs font-mono" style={{ color: "#64748B" }}>
                Page {page} of {totalPages}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {data?.items.map((candidate, i) => (
                <CandidateCard key={candidate.id} candidate={candidate as Parameters<typeof CandidateCard>[0]['candidate']} index={i} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg text-xs font-mono disabled:opacity-40"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Prev
                </button>
                <span className="text-xs font-mono px-4" style={{ color: "#64748B" }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg text-xs font-mono disabled:opacity-40"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Export */}
        {data && data.items.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.4, ease: easeOutExpo }}
            className="mt-12 flex justify-center"
          >
            <button
              onClick={() => {
                const csv = [
                  "id,smiles,track,pic50,confidence,quantum_score,citation_passed,mw,logp",
                  ...(data.items.map(c =>
                    `${c.id},"${c.smiles}",${c.track},${(c.pic50Predicted ?? 0).toFixed(3)},${(c.confidenceScore ?? 0).toFixed(3)},${c.quantumScore?.toFixed(3) ?? ""},${c.citationGatePassed},${c.mw ?? ""},${c.logp ?? ""}`
                  )),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `notus-candidates-page${page}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-mono"
              style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <Download size={16} /> Export CSV
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
