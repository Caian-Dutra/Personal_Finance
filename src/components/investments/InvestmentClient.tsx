"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrendingUp, Building2, Upload, RefreshCw, Loader2, BarChart2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { B3ImportDialog } from "./B3ImportDialog";
import { PortfolioTable } from "./PortfolioTable";
import { ProventosPanel } from "./ProventosPanel";
import { FixedIncomePanel } from "./FixedIncomePanel";
import { PortfolioHistoryChart } from "./PortfolioHistoryChart";
import type { PortfolioPosition } from "@/lib/investments/position";

async function fetchPortfolio(assetClass: string): Promise<PortfolioPosition[]> {
  const res = await fetch(`/api/investments/portfolio?assetClass=${assetClass}`);
  if (!res.ok) throw new Error("Erro ao carregar carteira");
  return res.json() as Promise<PortfolioPosition[]>;
}

export function InvestmentClient() {
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteWarning, setQuoteWarning] = useState<string | null>(null);

  const { data: stocks = [], isLoading: loadingStocks } = useQuery({
    queryKey: ["portfolio-stocks"],
    queryFn: () => fetchPortfolio("stock"),
  });

  const { data: fiis = [], isLoading: loadingFiis } = useQuery({
    queryKey: ["portfolio-fiis"],
    queryFn: () => fetchPortfolio("fii"),
  });

  async function handleRefreshQuotes() {
    setRefreshing(true);
    setQuoteWarning(null);
    try {
      const res = await fetch("/api/investments/quotes/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { error?: string; count?: number; saved?: string[]; errors?: string[] };

      if (!res.ok) {
        const msg = data.error ?? "Erro ao atualizar cotações";
        if (msg.includes("indisponível") || msg.includes("prisma generate")) {
          setQuoteWarning(msg);
        }
        throw new Error(msg);
      }

      const count = data.count ?? 0;
      if (count === 0) {
        setQuoteWarning("Nenhuma cotação retornada. Verifique BRAPI_TOKEN no .env.local e reinicie o servidor.");
        toast.warning("Nenhuma cotação atualizada");
      } else {
        toast.success(`${count} cotação(ões) atualizada(s)`);
        queryClient.invalidateQueries({ queryKey: ["portfolio-stocks"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-fiis"] });
      }

      if (data.errors?.length) {
        toast.warning(`${data.errors.length} ticker(s) com erro (pode ser normal para ativos com liquidez baixa)`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  function handleImported() {
    queryClient.invalidateQueries({ queryKey: ["portfolio-stocks"] });
    queryClient.invalidateQueries({ queryKey: ["portfolio-fiis"] });
    queryClient.invalidateQueries({ queryKey: ["investments-proventos"] });
    queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
  }

  const hasAnyData = stocks.length > 0 || fiis.length > 0;
  const quotedCount = [...stocks, ...fiis].filter((p) => p.currentPrice !== null).length;
  const totalCount = stocks.length + fiis.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Carteira de Investimentos</h1>
          {hasAnyData && (
            <p className="text-sm text-slate-500 mt-0.5">
              {stocks.length} ação(ões) · {fiis.length} FII(s)
              {totalCount > 0 && (
                <span className={`ml-2 ${quotedCount < totalCount ? "text-amber-500" : "text-emerald-500"}`}>
                  · {quotedCount}/{totalCount} com cotação
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshQuotes}
            disabled={refreshing || !hasAnyData}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Atualizar cotações
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-3.5 w-3.5" />
            Importar B3
          </Button>
        </div>
      </div>

      {quoteWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-none mt-0.5" />
          <div>
            <p className="text-sm text-amber-800">{quoteWarning}</p>
            <p className="text-xs text-amber-600 mt-1">
              Após adicionar o token, pare o servidor (<kbd className="font-mono bg-amber-100 px-1 rounded">Ctrl+C</kbd>),
              execute <kbd className="font-mono bg-amber-100 px-1 rounded">npx prisma generate</kbd> e depois{" "}
              <kbd className="font-mono bg-amber-100 px-1 rounded">npm run dev</kbd>.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="stocks">
        <TabsList className="mb-4">
          <TabsTrigger value="stocks" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Ações
            {stocks.length > 0 && (
              <span className="ml-1 text-xs bg-slate-200 text-slate-600 rounded px-1.5">{stocks.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fiis" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            FIIs
            {fiis.length > 0 && (
              <span className="ml-1 text-xs bg-slate-200 text-slate-600 rounded px-1.5">{fiis.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fixed">Renda Fixa</TabsTrigger>
          <TabsTrigger value="proventos">Proventos</TabsTrigger>
          <TabsTrigger value="evolution" className="gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" />
            Evolução
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stocks">
          {loadingStocks ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <PortfolioTable
              positions={stocks}
              title="Ações"
              emptyMessage="Nenhuma ação na carteira. Importe o arquivo B3 para começar."
            />
          )}
        </TabsContent>

        <TabsContent value="fiis">
          {loadingFiis ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <PortfolioTable
              positions={fiis}
              title="FIIs"
              emptyMessage="Nenhum FII na carteira. Importe o arquivo B3 para começar."
            />
          )}
        </TabsContent>

        <TabsContent value="fixed">
          <FixedIncomePanel />
        </TabsContent>

        <TabsContent value="proventos">
          <ProventosPanel />
        </TabsContent>

        <TabsContent value="evolution">
          <PortfolioHistoryChart />
        </TabsContent>
      </Tabs>

      <B3ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />
    </div>
  );
}
