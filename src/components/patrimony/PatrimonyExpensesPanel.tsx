"use client";

import { useState, useEffect, useCallback } from "react";
import { Link2, Unlink, Search, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/accounts";
import type { PatrimonyItemFull, PatrimonyExpenseLinked } from "@/types";

const SUGGESTED_KEYWORDS: Record<string, string[]> = {
  vehicle: ["IPVA", "LICENCIAMENTO", "SEGURO", "COMBUSTIVEL", "MANUTENCAO", "OFICINA", "DETRAN"],
  real_estate: ["IPTU", "CONDOMINIO", "AGUA", "LUZ", "GAS", "INTERNET", "MANUTENCAO"],
  other: [],
};

interface TxRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: { name: string; color: string } | null;
}

async function fetchExpenses(itemId: string): Promise<PatrimonyExpenseLinked[]> {
  const res = await fetch(`/api/patrimony/${itemId}/expenses`);
  if (!res.ok) throw new Error("Erro ao carregar despesas");
  return res.json() as Promise<PatrimonyExpenseLinked[]>;
}

async function searchTransactions(query: string): Promise<TxRow[]> {
  const params = new URLSearchParams({ search: query, limit: "20", page: "1" });
  const res = await fetch(`/api/transactions?${params}`);
  if (!res.ok) return [];
  const data = await res.json() as { transactions?: TxRow[] };
  return data.transactions ?? [];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PatrimonyItemFull | null;
  onExpensesChanged: () => void;
}

export function PatrimonyExpensesPanel({ open, onOpenChange, item, onExpensesChanged }: Props) {
  const [expenses, setExpenses] = useState<PatrimonyExpenseLinked[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TxRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!item) return;
    setLoadingExpenses(true);
    try {
      const data = await fetchExpenses(item.id);
      setExpenses(data);
    } finally {
      setLoadingExpenses(false);
    }
  }, [item]);

  useEffect(() => {
    if (open && item) {
      loadExpenses();
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, item, loadExpenses]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchTransactions(searchQuery);
        const linkedIds = new Set(expenses.map((e) => e.transactionId));
        setSearchResults(results.filter((r) => !linkedIds.has(r.id)));
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, expenses]);

  async function handleLink(txId: string) {
    if (!item) return;
    setLinkingId(txId);
    try {
      const res = await fetch(`/api/patrimony/${item.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId }),
      });
      if (res.ok) {
        await loadExpenses();
        setSearchQuery("");
        setSearchResults([]);
        onExpensesChanged();
      }
    } finally {
      setLinkingId(null);
    }
  }

  async function handleUnlink(expenseId: string) {
    if (!item) return;
    setUnlinkingId(expenseId);
    try {
      await fetch(`/api/patrimony/${item.id}/expenses/${expenseId}`, { method: "DELETE" });
      await loadExpenses();
      onExpensesChanged();
    } finally {
      setUnlinkingId(null);
    }
  }

  const keywords = SUGGESTED_KEYWORDS[item?.type ?? "other"] ?? [];
  const fmt = new Intl.DateTimeFormat("pt-BR");

  const totalExpenses = expenses.reduce((sum, e) => {
    return sum + Math.abs(e.transaction?.amount ?? 0);
  }, 0);

  const linkedTxIds = new Set(expenses.map((e) => e.transactionId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Custos vinculados — {item?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 min-h-0">
          {totalExpenses > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <Tag className="h-4 w-4 text-amber-600 flex-none" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Total de custos: {formatCurrency(totalExpenses)}
                </p>
                <p className="text-xs text-amber-600">{expenses.length} transação(ões) vinculada(s)</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  className="pl-8"
                  placeholder="Buscar transações por descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {searching && <Loader2 className="h-4 w-4 animate-spin text-slate-400 flex-none" />}
            </div>

            {keywords.length > 0 && !searchQuery && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-400 self-center">Sugestões:</span>
                {keywords.map((kw) => (
                  <button
                    key={kw}
                    className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                    onClick={() => setSearchQuery(kw)}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                <p className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50">
                  Resultados ({searchResults.length}) — clique para vincular
                </p>
                {searchResults.map((tx) => (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors ${
                      linkedTxIds.has(tx.id) ? "opacity-40 pointer-events-none" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{tx.description}</p>
                      <p className="text-xs text-slate-400">
                        {fmt.format(new Date(tx.date))}
                        {tx.category && (
                          <span
                            className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ backgroundColor: tx.category.color + "20", color: tx.category.color }}
                          >
                            {tx.category.name}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums flex-none ${tx.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatCurrency(Math.abs(tx.amount))}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-none h-7 text-xs"
                      onClick={() => handleLink(tx.id)}
                      disabled={linkingId === tx.id}
                    >
                      {linkingId === tx.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Link2 className="mr-1 h-3 w-3" />
                          Vincular
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !searching && (
              <p className="text-sm text-slate-400 text-center py-4">
                Nenhuma transação encontrada para &quot;{searchQuery}&quot;
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Vinculadas ({expenses.length})
            </p>
            {loadingExpenses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-8 text-center">
                <Link2 className="h-7 w-7 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">Nenhuma transação vinculada</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Use a busca acima para vincular transações a este bem
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {expenses.map((expense) => {
                  const tx = expense.transaction;
                  return (
                    <div key={expense.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate">
                          {tx?.description ?? expense.transactionId}
                        </p>
                        {tx && (
                          <p className="text-xs text-slate-400">
                            {fmt.format(new Date(tx.date))}
                            {tx.category && (
                              <span
                                className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: tx.category.color + "20", color: tx.category.color }}
                              >
                                {tx.category.name}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {tx && (
                        <span className="text-sm font-semibold tabular-nums flex-none text-red-600">
                          {formatCurrency(Math.abs(tx.amount))}
                        </span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-400 hover:text-red-600 flex-none"
                        title="Desvincular"
                        onClick={() => handleUnlink(expense.id)}
                        disabled={unlinkingId === expense.id}
                      >
                        {unlinkingId === expense.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Unlink className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
