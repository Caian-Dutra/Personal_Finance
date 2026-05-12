"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  total: number;
}

const fmt    = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background shadow-md px-3 py-2 text-sm space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold">{fmt.format(payload[0].value)}</p>
    </div>
  );
}

export function BalanceHistoryChart({ data }: { data: DataPoint[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      Sem dados no período
    </div>
  );

  const formatted = data.map((d) => ({
    ...d,
    label: fmtDay.format(new Date(d.date + "T12:00:00Z")),
  }));

  const min = Math.min(...data.map((d) => d.total));
  const max = Math.max(...data.map((d) => d.total));
  const pad = (max - min) * 0.1 || 100;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tickFormatter={(v: number) => fmt.format(v)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#balanceGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#3b82f6" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
