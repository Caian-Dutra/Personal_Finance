"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/accounts";
import type { PortfolioPosition } from "@/lib/investments/position";

const fmtQty = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);

const fmtPct = (n: number | null) =>
  n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

interface Props {
  positions: PortfolioPosition[];
  title: string;
  emptyMessage?: string;
}

export function PortfolioTable({ positions, title, emptyMessage }: Props) {
  const totalCost = positions.reduce((s, p) => s + p.totalCost, 0);
  const totalMarket = positions.reduce((s, p) => s + (p.marketValue ?? p.totalCost), 0);
  const totalGain = totalMarket - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const totalProventos = positions.reduce((s, p) => s + p.proventosTotal, 0);

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-400">
        {emptyMessage ?? "Nenhuma posição encontrada"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Valor de mercado", value: formatCurrency(totalMarket), sub: null },
          { label: "Custo total", value: formatCurrency(totalCost), sub: null },
          {
            label: "Ganho / Perda",
            value: formatCurrency(totalGain),
            sub: fmtPct(totalGainPct),
            positive: totalGain >= 0,
          },
          { label: "Proventos recebidos", value: formatCurrency(totalProventos), sub: null, accent: true },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 ${
              "positive" in card ? (card.positive ? "text-emerald-600" : "text-red-600") :
              card.accent ? "text-blue-600" : "text-slate-900"
            }`}>
              {card.value}
            </p>
            {card.sub && (
              <p className={`text-xs font-medium ${
                "positive" in card && card.positive ? "text-emerald-500" : "text-red-500"
              }`}>
                {card.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 font-medium">
                <th className="text-left px-4 py-3">Ticker</th>
                <th className="text-left px-3 py-3 hidden md:table-cell">Empresa</th>
                <th className="text-right px-3 py-3">Qtd</th>
                <th className="text-right px-3 py-3">P.Médio</th>
                <th className="text-right px-3 py-3">P.Atual</th>
                <th className="text-right px-3 py-3">Valor Mercado</th>
                <th className="text-right px-3 py-3">G/P R$</th>
                <th className="text-right px-4 py-3">G/P %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {positions.map((pos) => {
                const gp = pos.gainLoss;
                const gpPct = pos.gainLossPct;
                const noQuote = pos.currentPrice === null;

                return (
                  <tr key={pos.ticker} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-semibold text-slate-900">{pos.ticker}</span>
                        {pos.brokers.length > 0 && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[80px]">
                            {pos.brokers[0]}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-slate-500 text-xs truncate max-w-[160px]">
                      {pos.companyName || "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {fmtQty(pos.quantity)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(pos.avgPrice)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {noQuote ? (
                        <span className="text-slate-400 text-xs">Sem cotação</span>
                      ) : (
                        <span className="font-medium text-slate-900">{formatCurrency(pos.currentPrice!)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-900">
                      {pos.marketValue !== null ? formatCurrency(pos.marketValue) : formatCurrency(pos.totalCost)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {gp === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={gp >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {gp >= 0 ? "+" : ""}{formatCurrency(gp)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {gpPct === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={`flex items-center justify-end gap-1 text-xs font-semibold ${gpPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {gpPct >= 0.5 ? <TrendingUp className="h-3 w-3" /> :
                           gpPct <= -0.5 ? <TrendingDown className="h-3 w-3" /> :
                           <Minus className="h-3 w-3" />}
                          {fmtPct(gpPct)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
