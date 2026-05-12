"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, X, Link2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { TransferPair } from "@/lib/internalTransferDetector";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pairs: TransferPair[];
  autoLinked?: number;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls =
    pct >= 85 ? "bg-green-100 text-green-700" :
    pct >= 70 ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-600";
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{pct}%</span>;
}

export function InternalTransferDetectDialog({ open, onOpenChange, pairs, autoLinked = 0 }: Props) {
  const queryClient = useQueryClient();
  // Mapa: pairIndex → "accept" | "reject" | undefined
  const [decisions, setDecisions] = useState<Record<number, "accept" | "reject" | undefined>>({});

  const linkMutation = useMutation({
    mutationFn: async (ids: { outId: string; inId: string }) => {
      const res = await fetch(`/api/transactions/${ids.outId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedTransactionId: ids.inId }),
      });
      if (!res.ok) throw new Error("Erro ao vincular");
    },
  });

  async function applyDecisions() {
    const toLink = pairs.filter((_, i) => decisions[i] === "accept");
    for (const p of toLink) {
      await linkMutation.mutateAsync({ outId: p.outId, inId: p.inId });
    }
    if (toLink.length > 0) {
      toast.success(`${toLink.length} par(es) vinculado(s) com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
    onOpenChange(false);
    setDecisions({});
  }

  function decide(idx: number, action: "accept" | "reject") {
    setDecisions((prev) => ({ ...prev, [idx]: prev[idx] === action ? undefined : action }));
  }

  function acceptAll() {
    const all: Record<number, "accept"> = {};
    pairs.forEach((_, i) => { all[i] = "accept"; });
    setDecisions(all);
  }

  const accepted = pairs.filter((_, i) => decisions[i] === "accept").length;
  const pending  = pairs.filter((_, i) => decisions[i] === undefined).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Transferências internas detectadas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {autoLinked > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
              <Zap className="h-4 w-4 flex-shrink-0" />
              <span>
                <strong>{autoLinked}</strong> par{autoLinked > 1 ? "es" : ""} com alta confiança foram vinculados automaticamente.
              </span>
            </div>
          )}

          {pairs.length === 0 && autoLinked === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma transferência interna detectada.
            </p>
          )}

          {pairs.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {pairs.length} par{pairs.length > 1 ? "es" : ""} aguardando revisão
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={acceptAll}>
                  Aceitar todos
                </Button>
              </div>

              <div className="space-y-2">
                {pairs.map((pair, i) => {
                  const decision = decisions[i];
                  return (
                    <div
                      key={`${pair.outId}-${pair.inId}`}
                      className={`rounded-lg border p-3 transition-colors ${
                        decision === "accept" ? "border-green-300 bg-green-50" :
                        decision === "reject" ? "border-slate-200 bg-slate-50 opacity-50" :
                        "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Lado saída */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">{pair.outAccountName}</p>
                          <p className="text-sm font-medium truncate">{pair.outDescription}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-sm font-semibold text-red-600">
                              {fmt.format(pair.outAmount)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fmtDate.format(pair.outDate)}
                            </span>
                          </div>
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                        {/* Lado entrada */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">{pair.inAccountName}</p>
                          <p className="text-sm font-medium truncate">{pair.inDescription}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-sm font-semibold text-emerald-600">
                              {fmt.format(pair.inAmount)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fmtDate.format(pair.inDate)}
                            </span>
                          </div>
                        </div>

                        {/* Confiança + ações */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <ConfidenceBadge confidence={pair.confidence} />
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant={decision === "accept" ? "default" : "outline"}
                              className="h-7 w-7"
                              title="Vincular"
                              onClick={() => decide(i, "accept")}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant={decision === "reject" ? "destructive" : "outline"}
                              className="h-7 w-7"
                              title="Ignorar"
                              onClick={() => decide(i, "reject")}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            {pairs.length > 0 && (
              <>
                {accepted > 0 && <Badge variant="secondary">{accepted} para vincular</Badge>}
                {pending > 0 && <span>{pending} sem decisão (serão ignorados)</span>}
              </>
            )}
          </div>
          <Button variant="outline" onClick={() => { onOpenChange(false); setDecisions({}); }}>
            {pairs.length === 0 ? "Fechar" : "Cancelar"}
          </Button>
          {pairs.length > 0 && (
            <Button onClick={applyDecisions} disabled={linkMutation.isPending}>
              {linkMutation.isPending ? "Vinculando…" : `Confirmar (${accepted} par${accepted !== 1 ? "es" : ""})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
