"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PatrimonyItemFull } from "@/types";

interface ChartPoint {
  year: number;
  realEstate: number;
  vehicles: number;
  other: number;
  total: number;
}

function buildChartData(items: PatrimonyItemFull[]): ChartPoint[] {
  if (items.length === 0) return [];

  const earliest = items.reduce((min, item) => {
    const y = new Date(item.purchaseDate).getFullYear();
    return y < min ? y : min;
  }, new Date().getFullYear());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - earliest + 1 }, (_, i) => earliest + i);

  return years.map((year) => {
    let realEstate = 0;
    let vehicles = 0;
    let other = 0;

    for (const item of items) {
      const purchaseYear = new Date(item.purchaseDate).getFullYear();
      if (purchaseYear > year) continue;

      const valuesUpToYear = item.valueHistory
        .filter((v) => new Date(v.date).getFullYear() <= year)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const value = valuesUpToYear.length > 0 ? valuesUpToYear[0].value : item.purchaseValue;

      if (item.type === "real_estate") realEstate += value;
      else if (item.type === "vehicle") vehicles += value;
      else other += value;
    }

    return { year, realEstate, vehicles, other, total: realEstate + vehicles + other };
  });
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function formatTick(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return fmt.format(v);
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-sm">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-6">
          <span className="text-slate-500">{entry.name}</span>
          <span className="font-medium tabular-nums" style={{ color: entry.color }}>
            {fmt.format(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  items: PatrimonyItemFull[];
}

export function PatrimonyChart({ items }: Props) {
  const data = buildChartData(items);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Cadastre bens para ver a evolução do patrimônio
      </div>
    );
  }

  const hasRealEstate = items.some((i) => i.type === "real_estate");
  const hasVehicles = items.some((i) => i.type === "vehicle");
  const hasOther = items.some((i) => i.type === "other");

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRealEstate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradVehicles" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16A34A" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#16A34A" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9333EA" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#9333EA" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatTick} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
        />
        {hasRealEstate && (
          <Area
            type="monotone"
            dataKey="realEstate"
            name="Imóveis"
            stackId="1"
            stroke="#2563EB"
            strokeWidth={2}
            fill="url(#gradRealEstate)"
          />
        )}
        {hasVehicles && (
          <Area
            type="monotone"
            dataKey="vehicles"
            name="Veículos"
            stackId="1"
            stroke="#16A34A"
            strokeWidth={2}
            fill="url(#gradVehicles)"
          />
        )}
        {hasOther && (
          <Area
            type="monotone"
            dataKey="other"
            name="Outros"
            stackId="1"
            stroke="#9333EA"
            strokeWidth={2}
            fill="url(#gradOther)"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
