import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Activity, Zap, FlaskConical, GitBranch, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const TRACK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  A: { color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  B: { color: "#06B6D4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.3)" },
  C: { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)" },
  D: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
};

const TRACK_NAMES: Record<string, string> = {
  A: "ChEMBL Top Actives",
  B: "PDB Co-Crystal Ligands",
  C: "BindingDB Curated",
  D: "Diverse Scaffolds",
};

function LoopStatusBadge({ isRunning }: { isRunning: boolean }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-4 py-2"
      style={{
        border: `1px solid ${isRunning ? "rgba(16,185,129,0.3)" : "rgba(100,116,139,0.3)"}`,
        backgroundColor: isRunning ? "rgba(16,185,129,0.08)" : "rgba(100,116,139,0.08)",
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: 8, height: 8,
          backgroundColor: isRunning ? "#10B981" : "#64748B",
          boxShadow: isRunning ? "0 0 8px rgba(16,185,129,0.6)" : "none",
          animation: isRunning ? "pulse 2s infinite" : "none",
        }}
      />
      <span className="text-xs font-mono" style={{ color: isRunning ? "#10B981" : "#64748B" }}>
        {isRunning ? "CYCLE RUNNING" : "IDLE — NEXT CYCLE IN ~4H"}
      </span>
    </div>
  );
}

function CycleRow({ cycle, index }: { cycle: {
  id: number;
  cycleNumber: number;
  dayNumber: number;
  candidatesGenerated: number;
  candidatesVerified: number;
  bestPic50: number | null;
  convergenceCandidates: number;
  citationPassRate: string | null;
  createdAt: Date;
}; index: number }) {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: easeOutExpo }}
      className="grid grid-cols-6 gap-4 py-3 px-4 rounded-xl"
      style={{ backgroundColor: index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}
    >
      <div className="font-mono text-sm" style={{ color: "#F0F4F8" }}>#{cycle.cycleNumber}</div>
      <div className="font-mono text-sm" style={{ color: "#94A3B8" }}>Day {cycle.dayNumber}</div>
      <div className="font-mono text-sm" style={{ color: "#94A3B8" }}>{cycle.candidatesGenerated}</div>
      <div className="font-mono text-sm" style={{ color: "#10B981" }}>{cycle.candidatesVerified}</div>
      <div className="font-mono text-sm font-bold" style={{ color: "#06B6D4" }}>
        {cycle.bestPic50 !== null ? cycle.bestPic50.toFixed(2) : "—"}
      </div>
      <div className="font-mono text-xs" style={{ color: "#64748B" }}>
        {new Date(cycle.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5% 0px" });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.discovery.stats.useQuery(
    undefined,
    { refetchInterval: 30000 } // Refresh every 30s
  );
  const { data: loopStatus } = trpc.discovery.loopStatus.useQuery(
    undefined,
    { refetchInterval: 10000 } // Refresh every 10s
  );
  const { data: cycles, isLoading: cyclesLoading } = trpc.discovery.cycles.useQuery(
    { page: 1, pageSize: 10 },
    { refetchInterval: 60000 }
  );
  const { data: trackDist } = trpc.discovery.trackDistribution.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );
  const { data: bestCandidates } = trpc.discovery.bestCandidates.useQuery(
    { limit: 5 },
    { refetchInterval: 60000 }
  );

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
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="section-label">// LIVE DASHBOARD</span>
              <h1
                className="mt-4 mb-4"
                style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(32px, 4vw, 56px)", fontWeight: 700, color: "#F0F4F8", letterSpacing: "-1.5px" }}
              >
                Discovery <span style={{ color: "#10B981" }}>Engine</span>
              </h1>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <LoopStatusBadge isRunning={loopStatus?.isRunning ?? false} />
              <button
                onClick={() => refetchStats()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#64748B", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {/* Key stats */}
          {statsLoading ? (
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="stat-card animate-pulse">
                  <div className="h-7 w-16 rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
                  <div className="h-3 w-24 rounded mt-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Corpus Records", value: stats?.corpusSize.toLocaleString() ?? "0", color: "#10B981", icon: FlaskConical },
                { label: "Candidates Generated", value: stats?.totalCandidates.toLocaleString() ?? "0", color: "#06B6D4", icon: GitBranch },
                { label: "Best pIC50", value: stats?.bestPic50 && stats.bestPic50 > 0 ? stats.bestPic50.toFixed(2) : "—", color: "#8B5CF6", icon: Zap },
                { label: "Cycles Complete", value: stats?.totalCycles.toLocaleString() ?? "0", color: "#F59E0B", icon: Activity },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="stat-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} style={{ color: stat.color }} />
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#64748B", marginTop: 4 }}>{stat.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">

          {/* Track Distribution */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
          >
            <h2 className="font-mono text-sm mb-6" style={{ color: "#64748B" }}>// TRACK DISTRIBUTION</h2>
            {trackDist ? (
              <div className="flex flex-col gap-4">
                {trackDist.map(t => {
                  const tc = TRACK_COLORS[t.track];
                  const maxTotal = Math.max(...trackDist.map(x => x.total), 1);
                  const pct = (t.total / maxTotal) * 100;
                  return (
                    <div key={t.track}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold" style={{ color: tc.color }}>Track {t.track}</span>
                          <span className="text-xs font-mono" style={{ color: "#64748B" }}>{TRACK_NAMES[t.track]}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>{t.total} total</span>
                          <span className="text-xs font-mono" style={{ color: "#10B981" }}>{t.verified} verified</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: tc.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm font-mono" style={{ color: "#475569" }}>No data yet</span>
              </div>
            )}
          </motion.div>

          {/* Best Candidates */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.3, ease: easeOutExpo }}
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
          >
            <h2 className="font-mono text-sm mb-6" style={{ color: "#64748B" }}>// TOP VERIFIED CANDIDATES</h2>
            {bestCandidates && bestCandidates.length > 0 ? (
              <div className="flex flex-col gap-3">
                {bestCandidates.map((c, i) => {
                  const tc = TRACK_COLORS[c.track ?? "A"];
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-2 px-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tc.color}20` }}>
                        <span className="text-xs font-mono font-bold" style={{ color: tc.color }}>{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs truncate" style={{ color: "#94A3B8" }}>
                          {c.smiles?.substring(0, 40) ?? ""}...
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono" style={{ color: tc.color }}>Track {c.track}</span>
                          <CheckCircle size={10} style={{ color: "#10B981" }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-mono text-sm font-bold" style={{ color: "#06B6D4" }}>
                          {(c.pic50Predicted ?? 0).toFixed(2)}
                        </div>
                        <div className="text-xs font-mono" style={{ color: "#64748B" }}>pIC50</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <FlaskConical size={32} style={{ color: "#1E2D47" }} className="mx-auto mb-3" />
                  <span className="text-sm font-mono" style={{ color: "#475569" }}>No verified candidates yet</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Cycle History */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4, ease: easeOutExpo }}
          className="rounded-2xl p-6"
          style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
        >
          <h2 className="font-mono text-sm mb-6" style={{ color: "#64748B" }}>// RECENT CYCLES</h2>

          {cyclesLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm font-mono" style={{ color: "#64748B" }}>Loading cycles...</span>
            </div>
          ) : cycles && cycles.items.length > 0 ? (
            <>
              {/* Table header */}
              <div className="grid grid-cols-6 gap-4 py-2 px-4 mb-2">
                {["Cycle", "Day", "Generated", "Verified", "Best pIC50", "Time"].map(h => (
                  <div key={h} className="text-xs font-mono" style={{ color: "#475569" }}>{h}</div>
                ))}
              </div>
              {cycles.items.map((cycle, i) => (
                <CycleRow key={cycle.id} cycle={cycle as Parameters<typeof CycleRow>[0]['cycle']} index={i} />
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Clock size={32} style={{ color: "#1E2D47" }} />
              <div className="text-center">
                <div className="font-mono text-sm mb-2" style={{ color: "#64748B" }}>No cycles yet</div>
                <div className="font-mono text-xs" style={{ color: "#475569" }}>
                  The first cycle will run automatically in the next 4-hour window.
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Loop error display */}
        {loopStatus?.error && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-6 rounded-2xl p-4 flex items-start gap-3"
            style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertCircle size={16} style={{ color: "#EF4444", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="text-xs font-mono mb-1" style={{ color: "#EF4444" }}>LAST CYCLE ERROR</div>
              <div className="text-xs font-mono" style={{ color: "#94A3B8" }}>{loopStatus.error}</div>
            </div>
          </motion.div>
        )}

        {/* Best SMILES display */}
        {stats?.bestSmiles && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.5, ease: easeOutExpo }}
            className="mt-6 rounded-2xl p-6"
            style={{ backgroundColor: "#0D1425", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: "#10B981" }} />
              <span className="text-xs font-mono" style={{ color: "#10B981" }}>BEST CANDIDATE SO FAR — pIC50 {stats.bestPic50.toFixed(2)}</span>
            </div>
            <div
              className="font-mono text-xs p-3 rounded-lg break-all"
              style={{ backgroundColor: "rgba(0,0,0,0.3)", color: "#94A3B8" }}
            >
              {stats.bestSmiles}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
