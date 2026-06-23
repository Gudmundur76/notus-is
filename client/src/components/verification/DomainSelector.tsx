/**
 * DomainSelector — Phase-E
 *
 * Dropdown + grid of domain cards that lets the user filter the
 * VerificationDashboard to a single domain or view all 12 at once.
 *
 * Consumes: trpc.discovery.domainConfigs
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Globe, FlaskConical, Cpu, BookOpen, Leaf, Zap, Brain, Shield, TrendingUp, Building2, Microscope, Atom } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Domain icon map
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  biomedical: <FlaskConical size={14} />,
  climate: <Leaf size={14} />,
  materials: <Atom size={14} />,
  economics: <TrendingUp size={14} />,
  neuroscience: <Brain size={14} />,
  cybersecurity: <Shield size={14} />,
  energy: <Zap size={14} />,
  genomics: <Microscope size={14} />,
  pharmacology: <FlaskConical size={14} />,
  policy: <Building2 size={14} />,
  education: <BookOpen size={14} />,
  ai_safety: <Cpu size={14} />,
};

const STRATEGY_COLORS: Record<string, string> = {
  molecular: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  economic: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  text: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  numeric: "bg-violet-500/20 text-violet-400 border-violet-500/30",
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface DomainSelectorProps {
  selectedDomainId: string | null;
  onSelect: (domainId: string | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DomainSelector({ selectedDomainId, onSelect }: DomainSelectorProps) {
  const { data: domains, isLoading } = trpc.discovery.domainConfigs.useQuery();

  const selectedDomain = domains?.find((d) => d.id === selectedDomainId);
  const label = selectedDomain ? selectedDomain.name : "All Domains";

  return (
    <div className="flex flex-col gap-3">
      {/* Compact dropdown for mobile / header use */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <Globe size={14} className="text-teal-400" />
            {label}
            <ChevronDown size={12} className="text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-56 border-white/10 bg-slate-900 text-slate-200"
        >
          <DropdownMenuLabel className="text-xs text-slate-500">
            Select Domain
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={() => onSelect(null)}
            className={`cursor-pointer text-sm ${!selectedDomainId ? "text-teal-400" : ""}`}
          >
            All Domains
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          {isLoading && (
            <DropdownMenuItem disabled className="text-xs text-slate-500">
              Loading…
            </DropdownMenuItem>
          )}
          {domains?.map((d) => (
            <DropdownMenuItem
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={`cursor-pointer text-sm gap-2 ${
                selectedDomainId === d.id ? "text-teal-400" : ""
              }`}
            >
              <span className="text-slate-400">{DOMAIN_ICONS[d.id] ?? <Globe size={14} />}</span>
              {d.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Domain grid — only shown when "All Domains" is active */}
      {!selectedDomainId && domains && domains.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {domains.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-3 text-left
                         transition-all duration-150 hover:border-teal-500/40 hover:bg-white/10
                         active:scale-[0.97]"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-teal-400">
                  {DOMAIN_ICONS[d.id] ?? <Globe size={12} />}
                </span>
                <span className="text-xs font-medium text-slate-200 truncate">{d.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 border ${STRATEGY_COLORS[d.scoringStrategy] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}
                >
                  {d.scoringStrategy}
                </Badge>
                {d.quantumEnabled && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                  >
                    QC
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-slate-500">
                {d.adapters.length} adapters
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected domain detail chip */}
      {selectedDomain && (
        <div className="flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2">
          <span className="text-teal-400">
            {DOMAIN_ICONS[selectedDomain.id] ?? <Globe size={14} />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-teal-300">{selectedDomain.name}</p>
            <p className="text-xs text-slate-400 truncate">
              {selectedDomain.adapters.length} adapters · {selectedDomain.scoringStrategy} scoring
              {selectedDomain.quantumEnabled ? " · quantum VQE" : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect(null)}
            className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
          >
            ✕
          </Button>
        </div>
      )}
    </div>
  );
}
