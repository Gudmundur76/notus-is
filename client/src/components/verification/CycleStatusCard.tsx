import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";

type CycleStatus = "running" | "completed" | "failed" | "idle";

interface CycleStatusCardProps {
  status: CycleStatus;
  cycleId: string | null;
  startedAt: Date | null;
  currentPhase?: string | null;
  phasesCompleted?: number;
}

function useElapsedTime(startedAt: Date | null, active: boolean): string {
  const [elapsed, setElapsed] = useState("—");
  useEffect(() => {
    if (!startedAt || !active) {
      setElapsed("—");
      return;
    }
    const tick = () => {
      const ms = Date.now() - new Date(startedAt).getTime();
      const s = Math.floor(ms / 1000);
      if (s < 60) setElapsed(`${s}s`);
      else if (s < 3600) setElapsed(`${Math.floor(s / 60)}m ${s % 60}s`);
      else setElapsed(`${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, active]);
  return elapsed;
}

const STATUS_CONFIG: Record<CycleStatus, { label: string; color: string; icon: React.ReactNode; pulse: boolean }> = {
  running: {
    label: "RUNNING",
    color: "#F59E0B",
    icon: <Activity size={14} />,
    pulse: true,
  },
  completed: {
    label: "COMPLETED",
    color: "#10B981",
    icon: <CheckCircle2 size={14} />,
    pulse: false,
  },
  failed: {
    label: "FAILED",
    color: "#EF4444",
    icon: <XCircle size={14} />,
    pulse: false,
  },
  idle: {
    label: "IDLE",
    color: "#64748B",
    icon: <Clock size={14} />,
    pulse: false,
  },
};

const PHASE_LABELS: Record<string, string> = {
  discovery: "DISCOVER",
  scoring: "SCORE",
  verification: "VERIFY",
  cognition: "COGNITION",
  evolve: "EVOLVE",
  convergence: "CONVERGENCE",
};

export function CycleStatusCard({ status, cycleId, startedAt, currentPhase, phasesCompleted }: CycleStatusCardProps) {
  const cfg = STATUS_CONFIG[status];
  const elapsed = useElapsedTime(startedAt, status === "running");
  const shortId = cycleId ? cycleId.slice(0, 8) : "—";
  const phaseLabel = currentPhase ? (PHASE_LABELS[currentPhase] ?? currentPhase.toUpperCase()) : null;

  return (
    <Card
      className="relative overflow-hidden"
      style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
    >
      <CardHeader className="pb-2">
        <CardTitle
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
        >
          Current Cycle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          {cfg.pulse && (
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: cfg.color }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ backgroundColor: cfg.color }}
              />
            </span>
          )}
          <Badge
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold"
            style={{
              backgroundColor: `${cfg.color}20`,
              color: cfg.color,
              border: `1px solid ${cfg.color}40`,
            }}
          >
            {cfg.icon}
            {cfg.label}
          </Badge>
        </div>

        {/* Cycle ID */}
        <div>
          <span
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-headline)", color: "#F0F4F8" }}
          >
            {shortId}
          </span>
          <span
            className="ml-1 text-xs"
            style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
          >
            …
          </span>
        </div>

        {/* Phase + elapsed */}
        <div className="flex items-center justify-between text-xs" style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}>
          <span>
            {phaseLabel ? (
              <>
                Phase{" "}
                <span style={{ color: "#F59E0B" }}>{phaseLabel}</span>
              </>
            ) : phasesCompleted !== undefined ? (
              <>
                <span style={{ color: "#10B981" }}>{phasesCompleted}</span>
                <span>/6 phases done</span>
              </>
            ) : (
              "—"
            )}
          </span>
          <span style={{ color: status === "running" ? "#F59E0B" : "#64748B" }}>
            {elapsed}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
