"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Database, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/accounts";

interface MonthPoint {
  month: string;
  portfolioValue: number;
  portfolioCost: number;
  proventosAccum: number;
  returnPct: number;
  totalReturnPct: number;
  bova11Pct: number | null;
  xfix11Pct: number | null;
  hasPrices: boolean;
}

interface HistoryData {
  months: MonthPoint[];
  hasPriceHistory: boolean;
  tickersWithoutHistory: string[];
}

type Period = "6m" | "1a" | "2a" | "all";
type View = "value" | "return";

const PERIOD_MONTHS: Record<Period, number> = { "6m": 6, "1a": 12, "2a": 24, all: 9999 };

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(
    new Date(Number(y), Number(mo) - 1)
  );
}

function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return formatCurrency(v);
}

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label, view }: TooltipProps & { view: View }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1">
      <p className="font-semibold text-slate-700 mb-2">{fmtMonth(label)}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium tabular-nums" style={{ color: entry.color }}>
            {view === "value" ? fmtCurrency(entry.value) : fmtPct(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface FetchProgress {
  current: number;
  total: number;
  ticker: string;
}

export function PortfolioHistoryChart() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("all");
  const [view, setView] = useState<View>("value");
  const [fetchProgress, setFetchProgress] = useState<FetchProgress | null>(null);

  const { data, isLoading } = useQuery<HistoryData>({
    queryKey: ["portfolio-history"],
    queryFn: () => fetch("/api/investments/portfolio/history").then((r) => r.json()),
  });

  const fetchAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/investments/price-history/fetch-all", { method: "POST" });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Erro ao buscar histórico");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalSaved = 0;
      let tickers = 0;
      let rateLimitMessage: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

            if (event.type === "progress") {
              setFetchProgress({
                current: event.current as number,
                total: event.total as number,
                ticker: event.ticker as string,
              });
            } else if (event.type === "done") {
              totalSaved = event.totalSaved as number;
              tickers = event.tickers as number;
            } else if (event.type === "rate_limit") {
              rateLimitMessage = event.message as string;
            }
          } catch {
            // malformed SSE line — ignore
          }
        }
      }

      setFetchProgress(null);
      if (rateLimitMessage) throw new Error(rateLimitMessage);
      return { totalSaved, tickers };
    },
    onSuccess: (data) => {
      toast.success(
        `Histórico atualizado: ${data.totalSaved ?? 0} preços salvos para ${data.tickers ?? 0} ativos`
      );
      queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setFetchProgress(null),
  });

  if (isLoading) {
    return <div className="h-80 rounded-xl bg-slate-100 animate-pulse" />;
  }

  const months = data?.months ?? [];

  // Filter by period
  const cutoff = PERIOD_MONTHS[period];
  const filtered = months.slice(-cutoff);

  const hasBova11 = filtered.some((m) => m.bova11Pct !== null);
  const hasXfix11 = filtered.some((m) => m.xfix11Pct !== null);

  if (months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <TrendingUp className="h-10 w-10 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-600">Importe o arquivo B3 para ver o histórico</p>
          <p className="text-xs text-slate-400 mt-1">A evolução da carteira aparece aqui após a importação</p>
        </div>
      </div>
    );
  }

  const noPrices = !data?.hasPriceHistory;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1">
          {(["6m", "1a", "2a", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                period === p
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {p === "all" ? "Total" : p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button
              onClick={() => setView("value")}
              className={`px-3 py-1.5 ${view === "value" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Valor (R$)
            </button>
            <button
              onClick={() => setView("return")}
              className={`px-3 py-1.5 ${view === "return" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Retorno (%)
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAllMutation.mutate()}
            disabled={fetchAllMutation.isPending}
          >
            {fetchAllMutation.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Database className="mr-2 h-3.5 w-3.5" />
            )}
            {fetchAllMutation.isPending
              ? fetchProgress
                ? `Buscando histórico: ${fetchProgress.current}/${fetchProgress.total} ativos...`
                : "Iniciando..."
              : "Atualizar histórico"}
          </Button>
        </div>
      </div>

      {/* No price history warning */}
      {noPrices && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <Database className="h-4 w-4 text-amber-600 flex-none mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Histórico de preços não encontrado</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Clique em &quot;Atualizar histórico&quot; para buscar os preços via Brapi.
              O gráfico usa o custo como fallback.
              {data?.tickersWithoutHistory && data.tickersWithoutHistory.length > 0 && (
                <> Ativos sem preço: {data.tickersWithoutHistory.join(", ")}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        {view === "value" ? (
          <ComposedChart data={filtered} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tickFormatter={fmtMonth}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtCurrency}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip content={<CustomTooltip view="value" />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(v) => <span className="text-xs text-slate-600">{v}</span>}
            />
            <Area
              type="monotone"
              dataKey="portfolioCost"
              name="Custo investido"
              fill="url(#gradCost)"
              stroke="#cbd5e1"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="portfolioValue"
              name="Valor de mercado"
              fill="url(#gradPortfolio)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        ) : (
          <ComposedChart data={filtered} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tickFormatter={fmtMonth}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip view="return" />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(v) => <span className="text-xs text-slate-600">{v}</span>}
            />
            <Line
              type="monotone"
              dataKey="returnPct"
              name="Carteira (ganho)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="totalReturnPct"
              name="Carteira (total c/ proventos)"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 2"
            />
            {hasBova11 && (
              <Line
                type="monotone"
                dataKey="bova11Pct"
                name="BOVA11 (IBOV)"
                stroke="#f97316"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 3"
              />
            )}
            {hasXfix11 && (
              <Line
                type="monotone"
                dataKey="xfix11Pct"
                name="XFIX11 (IFIX)"
                stroke="#a855f7"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 3"
              />
            )}
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Summary stats for return view */}
      {view === "return" && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Retorno carteira",
              value: fmtPct(filtered[filtered.length - 1].returnPct),
              positive: filtered[filtered.length - 1].returnPct >= 0,
            },
            {
              label: "Retorno total (c/ proventos)",
              value: fmtPct(filtered[filtered.length - 1].totalReturnPct),
              positive: filtered[filtered.length - 1].totalReturnPct >= 0,
            },
            hasBova11 && filtered[filtered.length - 1].bova11Pct !== null
              ? {
                  label: "BOVA11 (IBOV)",
                  value: fmtPct(filtered[filtered.length - 1].bova11Pct!),
                  positive: filtered[filtered.length - 1].bova11Pct! >= 0,
                }
              : null,
            hasXfix11 && filtered[filtered.length - 1].xfix11Pct !== null
              ? {
                  label: "XFIX11 (IFIX)",
                  value: fmtPct(filtered[filtered.length - 1].xfix11Pct!),
                  positive: filtered[filtered.length - 1].xfix11Pct! >= 0,
                }
              : null,
          ]
            .filter(Boolean)
            .map((card) => (
              <div key={card!.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-400">{card!.label}</p>
                <p className={`text-lg font-bold tabular-nums ${card!.positive ? "text-emerald-600" : "text-red-600"}`}>
                  {card!.value}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
