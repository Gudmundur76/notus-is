import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface VerdictBreakdownProps {
  supported: number;
  contradicted: number;
  ambiguous: number;
}

const COLORS = {
  Supported: "#10B981",
  Contradicted: "#EF4444",
  Ambiguous: "#F59E0B",
};

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: { name: string; value: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const color = COLORS[item.name as keyof typeof COLORS] ?? "#64748B";
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: "#0D1425",
        border: "1px solid #1E2D47",
        fontFamily: "var(--font-mono)",
        color: "#F0F4F8",
      }}
    >
      <span style={{ color }}>{item.name}</span>: {item.value}
    </div>
  );
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#94A3B8" }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function VerdictBreakdown({ supported, contradicted, ambiguous }: VerdictBreakdownProps) {
  const total = supported + contradicted + ambiguous;

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center h-40 rounded-lg"
        style={{ backgroundColor: "#0A0F1C", border: "1px dashed #1E2D47" }}
      >
        <span style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          No verdicts yet
        </span>
      </div>
    );
  }

  const data = [
    { name: "Supported", value: supported },
    { name: "Contradicted", value: contradicted },
    { name: "Ambiguous", value: ambiguous },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <div
        className="text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
      >
        Verdict Distribution — {total.toLocaleString()} total
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name as keyof typeof COLORS] ?? "#64748B"}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
