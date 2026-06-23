import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ChevronRight, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

type CycleStatus = "running" | "completed" | "failed";

interface PhaseResult {
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number | null;
  itemCount?: number | null;
  error?: string | null;
}

interface VerificationCycle {
  cycleId: string;
  startedAt: Date;
  completedAt?: Date | null;
  status: CycleStatus | "running";
  phases: {
    discovery: PhaseResult;
    scoring: PhaseResult;
    verification: PhaseResult;
    cognition: PhaseResult;
    evolve: PhaseResult;
    convergence: PhaseResult;
  };
  candidatesDiscovered?: number | null;
  candidatesScored?: number | null;
  claimsVerified?: number | null;
  cognitionItemsAdded?: number | null;
  bestPic50?: number | null;
  durationMs?: number | null;
  evolvedQuery?: string | null;
}

interface CycleHistoryTableProps {
  cycles: VerificationCycle[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  running: { label: "Running", color: "#F59E0B", icon: <Loader2 size={10} className="animate-spin" /> },
  completed: { label: "Done", color: "#10B981", icon: <CheckCircle2 size={10} /> },
  failed: { label: "Failed", color: "#EF4444", icon: <XCircle size={10} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.failed;
  return (
    <Badge
      className="flex items-center gap-1 px-2 py-0.5 text-xs"
      style={{
        backgroundColor: `${cfg.color}20`,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
      }}
    >
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

const PHASE_KEYS = ["discovery", "scoring", "verification", "cognition", "evolve", "convergence"] as const;
const PHASE_LABELS: Record<string, string> = {
  discovery: "DISCOVER",
  scoring: "SCORE",
  verification: "VERIFY",
  cognition: "COGNITION",
  evolve: "EVOLVE",
  convergence: "CONVERGE",
};

function phasesCompleted(phases: VerificationCycle["phases"]): number {
  return PHASE_KEYS.filter((k) => phases[k]?.status === "completed").length;
}

function DrillDownModal({ cycle, open, onClose }: { cycle: VerificationCycle; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47", color: "#F0F4F8" }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-headline)", color: "#F0F4F8" }}>
            Cycle{" "}
            <span style={{ color: "#10B981", fontFamily: "var(--font-mono)", fontSize: 14 }}>
              {cycle.cycleId.slice(0, 8)}…
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Phase breakdown */}
        <div className="space-y-2 mt-2">
          <div
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
          >
            Phase Breakdown
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #1E2D47" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderBottom: "1px solid #1E2D47" }}>
                  <TableHead style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 11 }}>Phase</TableHead>
                  <TableHead style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 11 }}>Status</TableHead>
                  <TableHead style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 11 }}>Duration</TableHead>
                  <TableHead style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 11 }}>Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PHASE_KEYS.map((key) => {
                  const ph = cycle.phases[key];
                  return (
                    <TableRow key={key} style={{ borderBottom: "1px solid #1E2D4740" }}>
                      <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#94A3B8" }}>
                        {PHASE_LABELS[key]}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ph?.status ?? "pending"} />
                      </TableCell>
                      <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B" }}>
                        {formatDuration(ph?.durationMs)}
                      </TableCell>
                      <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B" }}>
                        {ph?.itemCount ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { label: "Candidates Discovered", value: cycle.candidatesDiscovered ?? "—" },
            { label: "Candidates Scored", value: cycle.candidatesScored ?? "—" },
            { label: "Claims Verified", value: cycle.claimsVerified ?? "—" },
            { label: "Cognition Items Added", value: cycle.cognitionItemsAdded ?? "—" },
            { label: "Best pIC50", value: cycle.bestPic50 ? cycle.bestPic50.toFixed(2) : "—" },
            { label: "Total Duration", value: formatDuration(cycle.durationMs) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg px-3 py-2"
              style={{ backgroundColor: "#0A0F1C", border: "1px solid #1E2D47" }}
            >
              <div style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 10 }}>{label}</div>
              <div style={{ color: "#F0F4F8", fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 700 }}>
                {String(value)}
              </div>
            </div>
          ))}
        </div>

        {/* Next evolved query */}
        {cycle.evolvedQuery && (
          <div className="mt-4">
            <div
              className="text-xs font-semibold tracking-widest uppercase mb-2"
              style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
            >
              Next Evolved Query
            </div>
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#10B981",
                fontFamily: "var(--font-mono)",
                wordBreak: "break-word",
              }}
            >
              {cycle.evolvedQuery}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CycleHistoryTable({
  cycles,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
}: CycleHistoryTableProps) {
  const [selectedCycle, setSelectedCycle] = useState<VerificationCycle | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={24} className="animate-spin" style={{ color: "#64748B" }} />
      </div>
    );
  }

  if (!cycles.length) {
    return (
      <div
        className="flex items-center justify-center h-32 rounded-lg"
        style={{ backgroundColor: "#0A0F1C", border: "1px dashed #1E2D47" }}
      >
        <span style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          No cycles recorded yet
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #1E2D47" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ backgroundColor: "#0A0F1C", borderBottom: "1px solid #1E2D47" }}>
              {["Cycle ID", "Started", "Status", "Phases", "Claims", "SR", "Duration", ""].map((h) => (
                <TableHead
                  key={h}
                  style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 11 }}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycles.map((cycle) => {
              const done = phasesCompleted(cycle.phases);
              const sr =
                cycle.claimsVerified && cycle.cognitionItemsAdded
                  ? `${Math.round((cycle.cognitionItemsAdded / cycle.claimsVerified) * 100)}%`
                  : "—";
              return (
                <TableRow
                  key={cycle.cycleId}
                  style={{ borderBottom: "1px solid #1E2D4740" }}
                  className="hover:bg-white/5 transition-colors"
                >
                  <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#94A3B8" }}>
                    {cycle.cycleId.slice(0, 8)}…
                  </TableCell>
                  <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B" }}>
                    {formatDate(cycle.startedAt)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={cycle.status} />
                  </TableCell>
                  <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B" }}>
                    <span style={{ color: done === 6 ? "#10B981" : "#F59E0B" }}>{done}</span>/6
                  </TableCell>
                  <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B" }}>
                    {cycle.claimsVerified ?? "—"}
                  </TableCell>
                  <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B" }}>
                    {sr}
                  </TableCell>
                  <TableCell style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B" }}>
                    {formatDuration(cycle.durationMs)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      style={{ color: "#64748B" }}
                      onClick={() => setSelectedCycle(cycle)}
                    >
                      Details <ChevronRight size={12} />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="mt-3">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className={page <= 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
              />
            </PaginationItem>
            <PaginationItem>
              <span
                className="px-3 py-1 text-xs"
                style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
              >
                {page} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className={page >= totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Drill-down modal */}
      {selectedCycle && (
        <DrillDownModal
          cycle={selectedCycle}
          open={!!selectedCycle}
          onClose={() => setSelectedCycle(null)}
        />
      )}
    </>
  );
}
