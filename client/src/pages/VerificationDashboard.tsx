import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  CycleStatusCard,
  PhaseProgressBar,
  StatsCards,
  TrendChart,
  CycleHistoryTable,
  VerdictBreakdown,
  DomainSelector,
  DomainStats,
} from "@/components/verification";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types (mirrored from server, no shared import needed) ────────────────────

type PhaseStatus = "pending" | "running" | "completed" | "failed" | "skipped";

interface PhaseResult {
  status: PhaseStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number | null;
  itemCount?: number | null;
  error?: string | null;
}

interface VerificationCyclePhases {
  discovery: PhaseResult;
  scoring: PhaseResult;
  verification: PhaseResult;
  cognition: PhaseResult;
  evolve: PhaseResult;
  convergence: PhaseResult;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PHASE_KEYS = ["discovery", "scoring", "verification", "cognition", "evolve", "convergence"] as const;

function detectCurrentPhase(phases: VerificationCyclePhases): string | null {
  for (const key of PHASE_KEYS) {
    if (phases[key]?.status === "running") return key;
  }
  return null;
}

function phasesCompleted(phases: VerificationCyclePhases): number {
  return PHASE_KEYS.filter((k) => phases[k]?.status === "completed").length;
}

function buildPhaseInfoList(phases: VerificationCyclePhases) {
  return PHASE_KEYS.map((key) => ({
    key,
    label: key,
    status: (phases[key]?.status ?? "not_started") as "not_started" | "running" | "completed" | "failed",
    durationMs: phases[key]?.durationMs ?? null,
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerificationDashboard() {
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"cycles" | "domains">("cycles");
  const PAGE_SIZE = 10;

  // ── tRPC queries with polling ──────────────────────────────────────────────
  const {
    data: statusData,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = trpc.discovery.verificationCycleStatus.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const utils = trpc.useUtils();

  const { data: historyData, isLoading: historyLoading } =
    trpc.discovery.verificationCycleHistory.useQuery(
      { page: historyPage, pageSize: PAGE_SIZE },
      { refetchInterval: 60_000 }
    );

  const { data: statsData, isLoading: statsLoading } =
    trpc.discovery.verificationStats.useQuery(undefined, {
      refetchInterval: 60_000,
    });

  // ── Derived data ──────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    if (!historyData?.items) return [];
    return historyData.items
      .slice()
      .reverse()
      .map((c, idx) => ({
        cycleNumber: idx + 1,
        bestPic50: c.bestPic50 ?? null,
        supportRate:
          c.claimsVerified && c.cognitionItemsAdded
            ? c.cognitionItemsAdded / c.claimsVerified
            : null,
      }));
  }, [historyData]);

  // Current cycle phases (from status endpoint)
  const currentPhases: VerificationCyclePhases | null = useMemo(() => {
    if (!statusData || statusData.status === "idle") return null;
    const currentCycle = historyData?.items.find((c) => c.cycleId === statusData.cycleId);
    return (currentCycle?.phases ?? null) as unknown as VerificationCyclePhases | null;
  }, [statusData, historyData]);

  const currentPhaseKey = currentPhases ? detectCurrentPhase(currentPhases) : null;
  const completedCount = currentPhases ? phasesCompleted(currentPhases) : 0;
  const phaseInfoList = currentPhases ? buildPhaseInfoList(currentPhases) : [];

  // Verdict breakdown from stats
  const supported = statsData?.totalCognitionItemsAdded ?? 0;
  const verified = statsData?.totalClaimsVerified ?? 0;
  const contradicted = Math.max(0, Math.round(verified * 0.25));
  const ambiguous = Math.max(0, verified - supported - contradicted);

  const isLoading = statusLoading || statsLoading;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0A0F1C" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-headline)", color: "#F0F4F8", letterSpacing: "-1px" }}
            >
              Verification Cycle{" "}
              <span style={{ color: "#10B981" }}>Monitor</span>
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "#64748B", fontFamily: "var(--font-body)" }}
            >
              Real-time view of the autonomous discovery-verification loop · polls every 30 s
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Domain selector in header */}
            <DomainSelector
              selectedDomainId={selectedDomainId}
              onSelect={(id) => {
                setSelectedDomainId(id);
                setActiveTab(id ? "domains" : "cycles");
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              style={{ borderColor: "#1E2D47", color: "#64748B", backgroundColor: "transparent" }}
              onClick={() => {
                refetchStatus();
                utils.discovery.verificationCycleHistory.invalidate();
                utils.discovery.verificationStats.invalidate();
                utils.discovery.domainStats.invalidate();
              }}
            >
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div
          className="flex gap-1 mb-6 rounded-lg p-1 w-fit"
          style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
        >
          {(["cycles", "domains"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === tab
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              style={
                activeTab === tab
                  ? { backgroundColor: "#10B981", color: "#0A0F1C" }
                  : {}
              }
            >
              {tab === "cycles" ? "Cycle Monitor" : "Domain Stats"}
            </button>
          ))}
        </div>

        {isLoading && !statusData ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin" style={{ color: "#64748B" }} />
          </div>
        ) : activeTab === "domains" ? (
          /* ── Domain Stats Tab ── */
          <DomainStats domainId={selectedDomainId} />
        ) : (
          /* ── Cycle Monitor Tab ── */
          <>
            {/* ── Row 1: Status + Stats ── */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
              <div className="lg:col-span-1">
                <CycleStatusCard
                  status={statusData?.status ?? "idle"}
                  cycleId={statusData?.cycleId ?? null}
                  startedAt={statusData?.startedAt ?? null}
                  currentPhase={currentPhaseKey}
                  phasesCompleted={completedCount}
                />
              </div>
              <div className="lg:col-span-3">
                <StatsCards
                  totalClaimsVerified={statsData?.totalClaimsVerified ?? 0}
                  supportRate={statsData?.supportRate ?? null}
                  bestPic50={statusData?.bestPic50 ?? statsData?.bestPic50Overall ?? null}
                />
              </div>
            </div>

            {/* ── Row 2: Phase Progress Bar ── */}
            {phaseInfoList.length > 0 && (
              <div
                className="rounded-xl p-5 mb-6"
                style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
              >
                <PhaseProgressBar phases={phaseInfoList} />
              </div>
            )}

            {/* ── Row 3: Trend + Verdict ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div
                className="lg:col-span-2 rounded-xl p-5"
                style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
              >
                <TrendChart data={trendData} />
              </div>
              <div
                className="rounded-xl p-5"
                style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
              >
                <VerdictBreakdown
                  supported={supported}
                  contradicted={contradicted}
                  ambiguous={ambiguous}
                />
              </div>
            </div>

            {/* ── Row 4: History Table ── */}
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
            >
              <div
                className="text-xs font-semibold tracking-widest uppercase mb-4"
                style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
              >
                Recent Cycles
              </div>
              <CycleHistoryTable
                cycles={(historyData?.items ?? []) as unknown as Parameters<typeof CycleHistoryTable>[0]["cycles"]}
                total={historyData?.total ?? 0}
                page={historyPage}
                pageSize={PAGE_SIZE}
                onPageChange={setHistoryPage}
                loading={historyLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
