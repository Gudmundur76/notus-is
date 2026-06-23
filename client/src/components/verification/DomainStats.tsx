/**
 * DomainStats — Phase-E
 *
 * Grid of per-domain stat cards showing today's activity and all-time aggregates.
 * Consumes: trpc.discovery.domainStats
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, TrendingUp, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface DomainStatsProps {
  /** When set, shows stats for a single domain only */
  domainId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DomainStats({ domainId }: DomainStatsProps) {
  const { data, isLoading, error } = trpc.discovery.domainStats.useQuery(
    domainId ? { domainId } : undefined,
    { refetchInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 size={18} className="animate-spin mr-2" />
        Loading domain stats…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        Failed to load domain stats: {error.message}
      </div>
    );
  }

  if (!data || data.domains.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-500">
        No domain activity recorded yet. The first batch will run at the next scheduled interval.
      </div>
    );
  }

  // Summary header
  const totalClaims = data.domains.reduce((s, d) => s + d.totalClaimsVerified, 0);
  const totalSupported = data.domains.reduce((s, d) => s + d.totalSupported, 0);
  const supportRate = totalClaims > 0 ? Math.round((totalSupported / totalClaims) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Active Domains",
            value: data.totalDomainsActive,
            icon: <Globe size={14} className="text-teal-400" />,
            color: "text-teal-400",
          },
          {
            label: "Total Claims",
            value: totalClaims.toLocaleString(),
            icon: <TrendingUp size={14} className="text-sky-400" />,
            color: "text-sky-400",
          },
          {
            label: "Support Rate",
            value: supportRate != null ? `${supportRate}%` : "—",
            icon: <CheckCircle2 size={14} className="text-emerald-400" />,
            color: "text-emerald-400",
          },
          {
            label: "Domains Tracked",
            value: data.domains.length,
            icon: <Globe size={14} className="text-violet-400" />,
            color: "text-violet-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {stat.icon}
              {stat.label}
            </div>
            <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Per-domain cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.domains.map((d) => {
          const domainSupportRate =
            d.totalClaimsVerified > 0
              ? Math.round((d.totalSupported / d.totalClaimsVerified) * 100)
              : null;

          return (
            <Card
              key={d.domainId}
              className="border-white/10 bg-white/5 text-slate-200"
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="capitalize">{d.domainId.replace(/_/g, " ")}</span>
                  {d.todayCyclesCompleted > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border bg-teal-500/20 text-teal-400 border-teal-500/30"
                    >
                      {d.todayCyclesCompleted} today
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 flex flex-col gap-2">
                {/* Claim counts */}
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span className="text-xs font-mono text-emerald-400">{d.totalSupported}</span>
                    <span className="text-[10px] text-slate-500">Supported</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <XCircle size={12} className="text-red-400" />
                    <span className="text-xs font-mono text-red-400">{d.totalContradicted}</span>
                    <span className="text-[10px] text-slate-500">Contradicted</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <HelpCircle size={12} className="text-amber-400" />
                    <span className="text-xs font-mono text-amber-400">{d.totalAmbiguous}</span>
                    <span className="text-[10px] text-slate-500">Ambiguous</span>
                  </div>
                </div>

                {/* Support rate bar */}
                {domainSupportRate != null && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Support rate</span>
                      <span className="text-emerald-400 font-mono">{domainSupportRate}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${domainSupportRate}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Best pIC50 */}
                {d.bestPic50 != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Best pIC50</span>
                    <span className="font-mono text-sky-400">{d.bestPic50.toFixed(2)}</span>
                  </div>
                )}

                {/* Total cycles */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total cycles</span>
                  <span className="font-mono text-slate-300">{d.totalCycles}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
