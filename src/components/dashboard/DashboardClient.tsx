"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyFlowChart } from "@/components/charts/MonthlyFlowChart";
import { BalanceHistoryChart } from "@/components/charts/BalanceHistoryChart";
import { ExpensesByCategoryChart } from "@/components/charts/ExpensesByCategoryChart";
import { DateRangePicker, getRange, type DateRange } from "@/components/ui/date-range-picker";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Summary {
  from: string;
  to: string;
  income: number;
  expenses: number;
  net: number;
  totalBalance: number;
  prev: { income: number; expenses: number; net: number };
}

interface FlowPoint    { label: string; income: number; expenses: number }
interface BalancePoint { date: string; total: number }
interface CategoryPoint { id: string; name: string; color: string; total: number }

// ── Formatação ───────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function delta(cur: number, prev: number) {
  if (prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function DeltaBadge({ pct, invertColor }: { pct: number | null; invertColor?: boolean }) {
  if (pct === null) return null;
  // Para despesas, aumento é ruim (vermelho); para receita/saldo, aumento é bom (verde)
  const isPositive = invertColor ? pct <= 0 : pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
      {pct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function KpiSkeleton() { return <div className="h-24 rounded-xl bg-muted animate-pulse" />; }
function ChartSkeleton() { return <div className="h-52 rounded-xl bg-muted animate-pulse" />; }

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiProps {
  title: string;
  value: number;
  delta?: number | null;
  invertDeltaColor?: boolean;
  sub?: string;
  icon: React.ReactNode;
  valueClass?: string;
}

function KpiCard({ title, value, delta: d, invertDeltaColor, sub, icon, valueClass }: KpiProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={`text-2xl font-bold tabular-nums ${valueClass ?? ""}`}>
          {fmt.format(value)}
        </p>
        <div className="flex items-center gap-1 mt-1 h-4">
          {d !== undefined && <DeltaBadge pct={d} invertColor={invertDeltaColor} />}
          {d !== undefined && <span className="text-xs text-muted-foreground">{sub ?? "vs período anterior"}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function DashboardClient() {
  // Período padrão: 1 ano
  const [range, setRange] = useState<DateRange>(() => getRange("1y"));

  const qp = `from=${range.from}&to=${range.to}`;

  const { data: summary, isLoading: loadSum } = useQuery<Summary>({
    queryKey: ["dashboard-summary", range.from, range.to],
    queryFn: () => fetch(`/api/dashboard/summary?${qp}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: flows = [], isLoading: loadFlows } = useQuery<FlowPoint[]>({
    queryKey: ["dashboard-monthly-flows", range.from, range.to],
    queryFn: () => fetch(`/api/dashboard/monthly-flows?${qp}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: balHistory = [], isLoading: loadBal } = useQuery<BalancePoint[]>({
    queryKey: ["dashboard-balance-history", range.from, range.to],
    queryFn: () => fetch(`/api/dashboard/balance-history?${qp}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: categories = [], isLoading: loadCat } = useQuery<CategoryPoint[]>({
    queryKey: ["dashboard-expenses-by-category", range.from, range.to],
    queryFn: () => fetch(`/api/dashboard/expenses-by-category?${qp}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho + filtro */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loadSum ? (
          [1, 2, 3, 4].map((i) => <KpiSkeleton key={i} />)
        ) : summary ? (
          <>
            <KpiCard
              title="Saldo total atual"
              value={summary.totalBalance}
              icon={<Wallet className="h-4 w-4" />}
              valueClass={summary.totalBalance >= 0 ? "text-foreground" : "text-red-600"}
            />
            <KpiCard
              title="Receitas"
              value={summary.income}
              delta={delta(summary.income, summary.prev.income)}
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              valueClass="text-emerald-600"
            />
            <KpiCard
              title="Despesas"
              value={Math.abs(summary.expenses)}
              delta={delta(Math.abs(summary.expenses), Math.abs(summary.prev.expenses))}
              invertDeltaColor
              icon={<TrendingDown className="h-4 w-4 text-red-500" />}
              valueClass="text-red-600"
            />
            <KpiCard
              title="Resultado"
              value={summary.net}
              delta={delta(summary.net, summary.prev.net)}
              icon={
                summary.net >= 0
                  ? <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  : <ArrowDownRight className="h-4 w-4 text-red-500" />
              }
              valueClass={summary.net >= 0 ? "text-emerald-600" : "text-red-600"}
            />
          </>
        ) : null}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Evolução do saldo — 2/3 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Evolução do saldo</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loadBal ? <ChartSkeleton /> : <BalanceHistoryChart data={balHistory} />}
          </CardContent>
        </Card>

        {/* Despesas por categoria — 1/3 */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadCat ? <ChartSkeleton /> : <ExpensesByCategoryChart data={categories} />}
          </CardContent>
        </Card>

        {/* Receitas vs Despesas por mês — largura total */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Receitas vs Despesas por mês</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loadFlows ? <ChartSkeleton /> : <MonthlyFlowChart data={flows} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
