import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";

interface CycleTrendPoint {
  cycleNumber: number;
  bestPic50: number | null;
  supportRate: number | null;
}

interface TrendChartProps {
  data: CycleTrendPoint[];
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: CycleTrendPoint;
}

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const rate = payload.supportRate ?? 0;
  const color = rate > 0.6 ? "#10B981" : rate < 0.4 ? "#EF4444" : "#F59E0B";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#0D1425" strokeWidth={2} />;
}

interface TooltipPayloadItem {
  value: number;
  name: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const pic50 = payload[0]?.value;
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
      <div style={{ color: "#64748B" }}>Cycle #{label}</div>
      <div>
        pIC50:{" "}
        <span style={{ color: "#8B5CF6", fontWeight: 700 }}>
          {pic50 !== null && pic50 !== undefined ? pic50.toFixed(2) : "—"}
        </span>
      </div>
    </div>
  );
}

export function TrendChart({ data }: TrendChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center h-40 rounded-lg"
        style={{ backgroundColor: "#0A0F1C", border: "1px dashed #1E2D47" }}
      >
        <span style={{ color: "#64748B", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          No cycle data yet — first cycle will populate this chart
        </span>
      </div>
    );
  }

  // Filter to cycles with a pIC50 value and take last 30
  const chartData = data
    .filter((d) => d.bestPic50 !== null)
    .slice(-30)
    .map((d) => ({
      ...d,
      bestPic50: d.bestPic50 ?? 0,
    }));

  return (
    <div>
      <div
        className="text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: "#64748B", fontFamily: "var(--font-mono)" }}
      >
        Best pIC50 Trend — Last {Math.min(chartData.length, 30)} Cycles
      </div>
      <div className="flex items-center gap-4 mb-3 text-xs" style={{ fontFamily: "var(--font-mono)", color: "#64748B" }}>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#10B981" }} />
          SR &gt; 60%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
          SR 40–60%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#EF4444" }} />
          SR &lt; 40%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2D47" />
          <XAxis
            dataKey="cycleNumber"
            tick={{ fill: "#64748B", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "#1E2D47" }}
            label={{ value: "Cycle #", position: "insideBottom", offset: -2, fill: "#64748B", fontSize: 9 }}
          />
          <YAxis
            domain={[0, 14]}
            tick={{ fill: "#64748B", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "#1E2D47" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="bestPic50"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6, fill: "#8B5CF6", stroke: "#0D1425", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
