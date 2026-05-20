"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/accounts";

interface ProventoRow {
  id: string;
  ticker: string;
  assetClass: string;
  type: string;
  date: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  broker: string | null;
}

interface ProventosData {
  proventos: ProventoRow[];
  monthlyChart: { month: string; total: number }[];
  total: number;
}

const TYPE_LABELS: Record<string, string> = {
  dividend: "Dividendo",
  jcp: "JCP",
  rendimento: "Rendimento",
  redemption: "Resgate",
};

const fmt = new Intl.DateTimeFormat("pt-BR");
const fmtMonth = (m: string) => {
  const [y, mo] = m.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(Number(y), Number(mo) - 1));
};

export function ProventosPanel() {
  const { data, isLoading } = useQuery<ProventosData>({
    queryKey: ["investments-proventos"],
    queryFn: () =>
      fetch("/api/investments/proventos").then((r) => r.json()),
  });

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />;
  }

  const proventos = data?.proventos ?? [];
  const chart = (data?.monthlyChart ?? []).slice(-12);
  const total = data?.total ?? 0;

  if (proventos.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-400">
        Nenhum provento registrado. Importe o arquivo B3 para visualizar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-400">Total recebido</p>
          <p className="text-xl font-bold text-blue-600 tabular-nums">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-400">Média mensal (12m)</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(chart.reduce((s, c) => s + c.total, 0) / Math.max(chart.length, 1))}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-400">Registros</p>
          <p className="text-xl font-bold text-slate-900">{proventos.length}</p>
        </div>
      </div>

      {chart.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-700 mb-4">Proventos por mês (últimos 12m)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chart} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonth}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                formatter={(v: unknown) => [formatCurrency(Number(v)), "Proventos"]}
                labelFormatter={(label: unknown) => fmtMonth(String(label))}
              />
              <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 font-medium">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-3 py-3">Ticker</th>
                <th className="text-left px-3 py-3">Tipo</th>
                <th className="text-right px-3 py-3">Qtd</th>
                <th className="text-right px-3 py-3">Valor/ação</th>
                <th className="text-right px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {proventos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">
                    {fmt.format(new Date(p.date))}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{p.ticker}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                      {TYPE_LABELS[p.type] ?? p.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {new Intl.NumberFormat("pt-BR").format(p.quantity)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {formatCurrency(p.unitValue)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-600">
                    {formatCurrency(p.totalValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
