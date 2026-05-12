"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

interface DataPoint {
  label: string;
  income: number;
  expenses: number;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background shadow-md px-3 py-2 text-sm space-y-1">
      <p className="font-medium capitalize">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name === "income" ? "Receitas" : "Despesas"}:</span>
          <span className="font-medium">{fmt.format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const BAR_PROPS = {
  cartesianGrid: { strokeDasharray: "3 3", stroke: "hsl(var(--border))", vertical: false as const },
  xAxis: { axisLine: false, tickLine: false, tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } },
  yAxis: { axisLine: false, tickLine: false, width: 72, tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } },
};

export function MonthlyFlowChart({ data }: { data: DataPoint[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      Sem dados no período
    </div>
  );

  const useScroll = data.length > 12;
  const scrollWidth = data.length * 64;

  const bars = (
    <>
      <CartesianGrid {...BAR_PROPS.cartesianGrid} />
      <XAxis dataKey="label" {...BAR_PROPS.xAxis} />
      <YAxis tickFormatter={(v: number) => fmt.format(v)} {...BAR_PROPS.yAxis} />
      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
      <Legend
        formatter={(v) => v === "income" ? "Receitas" : "Despesas"}
        iconType="circle"
        iconSize={8}
        wrapperStyle={{ fontSize: 12 }}
      />
      <Bar dataKey="income"   name="income"   fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
      <Bar dataKey="expenses" name="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
    </>
  );

  if (useScroll) {
    return (
      <div className="overflow-x-auto">
        <BarChart data={data} width={scrollWidth} height={220} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
          {bars}
        </BarChart>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4}>
        {bars}
      </BarChart>
    </ResponsiveContainer>
  );
}
