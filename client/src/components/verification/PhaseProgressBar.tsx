import { CheckCircle2, XCircle } from "lucide-react";

type PhaseStatus = "not_started" | "running" | "completed" | "failed";

interface PhaseInfo {
  key: string;
  label: string;
  status: PhaseStatus;
  durationMs?: number | null;
}

interface PhaseProgressBarProps {
  phases: PhaseInfo[];
}

const PHASE_KEYS = ["discovery", "scoring", "verification", "cognition", "evolve", "convergence"];
const PHASE_LABELS: Record<string, string> = {
  discovery: "DISCOVER",
  scoring: "SCORE",
  verification: "VERIFY",
  cognition: "COGNITION",
  evolve: "EVOLVE",
  convergence: "CONVERGE",
};

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const PHASE_COLORS: Record<PhaseStatus, { bg: string; border: string; text: string }> = {
  not_started: { bg: "#1E2D47", border: "#1E2D47", text: "#64748B" },
  running: { bg: "rgba(245,158,11,0.15)", border: "#F59E0B", text: "#F59E0B" },
  completed: { bg: "rgba(16,185,129,0.15)", border: "#10B981", text: "#10B981" },
  failed: { bg: "rgba(239,68,68,0.15)", border: "#EF4444", text: "#EF4444" },
};

export function PhaseProgressBar({ phases }: PhaseProgressBarProps) {
  // Ensure we always have all 6 phases, filling missing ones as not_started
  const phaseMap = new Map(phases.map((p) => [p.key, p]));
  const allPhases: PhaseInfo[] = PHASE_KEYS.map((key) => ({
    key,
    label: PHASE_LABELS[key],
    status: phaseMap.get(key)?.status ?? "not_started",
    durationMs: phaseMap.get(key)?.durationMs,
  }));

  return (
    <div className="space-y-2">
      <div
        className="text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
      >
        Phase Progress
      </div>
      <div className="flex gap-1.5">
        {allPhases.map((phase) => {
          const colors = PHASE_COLORS[phase.status];
          const isRunning = phase.status === "running";
          return (
            <div
              key={phase.key}
              className="flex-1 relative rounded-md px-2 py-2.5 transition-all duration-300"
              style={{
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                minWidth: 0,
              }}
            >
              {/* Animated shimmer for running phase */}
              {isRunning && (
                <div
                  className="absolute inset-0 rounded-md overflow-hidden pointer-events-none"
                  aria-hidden
                >
                  <div
                    className="absolute inset-0 animate-pulse"
                    style={{ backgroundColor: "rgba(245,158,11,0.08)" }}
                  />
                </div>
              )}

              <div className="relative z-10 flex flex-col items-center gap-1">
                {/* Status icon */}
                <div className="flex items-center justify-center h-4">
                  {phase.status === "completed" && (
                    <CheckCircle2 size={12} style={{ color: "#10B981" }} />
                  )}
                  {phase.status === "failed" && (
                    <XCircle size={12} style={{ color: "#EF4444" }} />
                  )}
                  {isRunning && (
                    <span className="relative flex h-2 w-2">
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: "#F59E0B" }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-2 w-2"
                        style={{ backgroundColor: "#F59E0B" }}
                      />
                    </span>
                  )}
                  {phase.status === "not_started" && (
                    <span
                      className="inline-flex rounded-full h-2 w-2"
                      style={{ backgroundColor: "#1E2D47", border: "1px solid #334155" }}
                    />
                  )}
                </div>

                {/* Phase label */}
                <span
                  className="text-center leading-tight"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 700,
                    color: colors.text,
                    letterSpacing: "0.05em",
                    wordBreak: "break-all",
                  }}
                >
                  {phase.label}
                </span>

                {/* Duration */}
                {phase.durationMs ? (
                  <span
                    style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#64748B" }}
                  >
                    {formatDuration(phase.durationMs)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
