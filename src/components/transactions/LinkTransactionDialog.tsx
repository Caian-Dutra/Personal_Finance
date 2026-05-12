"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TxRow } from "./TransactionTable";

interface Props {
  transaction: TxRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface SearchResult {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: { name: string };
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function LinkTransactionDialog({ transaction, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<SearchResult | null>(null);

  async function handleSearch() {
    if (!transaction) return;
    setSearching(true);
    setChosen(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      // Busca no mesmo período ± 7 dias do valor oposto
      const date = new Date(transaction.date);
      params.set("from", new Date(date.getTime() - 7 * 86_400_000).toISOString().slice(0, 10));
      params.set("to",   new Date(date.getTime() + 7 * 86_400_000).toISOString().slice(0, 10));
      params.set("page", "1");

      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json() as { transactions: SearchResult[] };
      // Exclui a própria transação e as que já são internas
      setResults(data.transactions.filter((t) => t.id !== transaction.id));
    } finally {
      setSearching(false);
    }
  }

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/transactions/${transaction!.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedTransactionId: chosen!.id }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      toast.success("Transferência interna vinculada");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
      setSearch("");
      setResults([]);
      setChosen(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleClose(v: boolean) {
    if (!v) { setSearch(""); setResults([]); setChosen(null); }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Vincular transferência manualmente
          </DialogTitle>
        </DialogHeader>

        {transaction && (
          <div className="space-y-4 py-1">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-0.5">
              <p className="font-medium truncate">{transaction.description}</p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{transaction.account.name}</span>
                <span className={transaction.amount < 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                  {fmt.format(transaction.amount)}
                </span>
                <span>{fmtDate.format(new Date(transaction.date))}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Buscar transação correspondente</Label>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, conta..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                />
                <Button size="sm" variant="outline" className="h-8" onClick={handleSearch} disabled={searching}>
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {results.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setChosen(chosen?.id === r.id ? null : r)}
                    className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                      chosen?.id === r.id
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:bg-muted/40"
                    }`}
                  >
                    <p className="font-medium truncate">{r.description}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{r.account.name}</span>
                      <span className={r.amount < 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                        {fmt.format(r.amount)}
                      </span>
                      <span>{fmtDate.format(new Date(r.date))}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {results.length === 0 && !searching && search && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação encontrada.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button
            onClick={() => linkMutation.mutate()}
            disabled={!chosen || linkMutation.isPending}
          >
            {linkMutation.isPending ? "Vinculando…" : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
