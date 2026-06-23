import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, TrendingUp, Atom } from "lucide-react";

interface StatsCardsProps {
  totalClaimsVerified: number;
  supportRate: number | null;
  bestPic50: number | null;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
  loading?: boolean;
}

function StatCard({ title, value, subtitle, icon, accentColor, loading }: StatCardProps) {
  return (
    <Card
      className="relative overflow-hidden"
      style={{ backgroundColor: "#0D1425", border: "1px solid #1E2D47" }}
    >
      {/* Accent glow */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)`,
          transform: "translate(30%, -30%)",
        }}
      />
      <CardHeader className="pb-1">
        <CardTitle
          className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase"
          style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-20 rounded animate-pulse" style={{ backgroundColor: "#1E2D47" }} />
        ) : (
          <>
            <div
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-headline)", color: "#F0F4F8" }}
            >
              {value}
            </div>
            {subtitle && (
              <div
                className="mt-1 text-xs"
                style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
              >
                {subtitle}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsCards({ totalClaimsVerified, supportRate, bestPic50 }: StatsCardsProps) {
  const supportRateStr =
    supportRate !== null && supportRate !== undefined
      ? `${Math.round(supportRate * 100)}%`
      : "—";

  const pic50Str =
    bestPic50 !== null && bestPic50 !== undefined
      ? bestPic50.toFixed(2)
      : "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        title="Total Claims Verified"
        value={totalClaimsVerified.toLocaleString()}
        subtitle="across all cycles"
        icon={<ShieldCheck size={12} />}
        accentColor="#06B6D4"
      />
      <StatCard
        title="Support Rate"
        value={supportRateStr}
        subtitle="Supported / Total"
        icon={<TrendingUp size={12} />}
        accentColor="#10B981"
      />
      <StatCard
        title="Best pIC50"
        value={pic50Str}
        subtitle="highest this session"
        icon={<Atom size={12} />}
        accentColor="#8B5CF6"
      />
    </div>
  );
}
