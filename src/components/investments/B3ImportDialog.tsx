"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/accounts";
import type { B3Row } from "@/lib/parsers/b3-movimentacao";

const ASSET_CLASS_LABEL: Record<string, string> = {
  stock: "Ação",
  fii: "FII",
  etf: "ETF",
  bdr: "BDR",
};

const TYPE_LABEL: Record<string, string> = {
  buy: "Compra",
  sell: "Venda",
  dividend: "Dividendo",
  jcp: "JCP",
  rendimento: "Rendimento",
  split: "Desdobro",
  reverse_split: "Grupamento",
  bonus_shares: "Bonificação",
  fraction_sale: "Leilão de Fração",
  custody_transfer: "Transf. Custódia",
  lending: "Empréstimo",
  update: "Atualização",
  subscription_right: "Direito de Subscrição",
  redemption: "Resgate",
  fixed_income_apply: "Aplicação RF",
  unknown: "Outros",
};

interface TickerGroup {
  ticker: string;
  companyName: string;
  assetClass: string;
  operationCount: number;
  operations: B3Row[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function B3ImportDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<TickerGroup[]>([]);
  const [allRows, setAllRows] = useState<B3Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [result, setResult] = useState<{ operations: number; proventos: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setPreview([]);
    setAllRows([]);
    setFileName("");
    setExpandedTicker(null);
    setResult(null);
    setError(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/investments/import/b3", { method: "POST", body: form });
      const data = await res.json() as { preview?: TickerGroup[]; totalRows?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao processar arquivo");
      setPreview(data.preview ?? []);
      setAllRows(data.preview?.flatMap((g) => g.operations) ?? []);
      setStep("preview");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch("/api/investments/import/b3/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, rows: allRows }),
      });
      const data = await res.json() as { operations: number; proventos: number; skipped: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao confirmar importação");
      setResult(data);
      setStep("done");
      onImported();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const totalOps = preview.reduce((s, g) => s + g.operationCount, 0);
  const proventoGroups = preview.filter((g) =>
    g.operations.some((o) => ["dividend", "jcp", "rendimento"].includes(o.type))
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Importar Movimentação B3
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {step === "upload" && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
                <Upload className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Selecione o arquivo xlsx da B3</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Exportado pelo CEI (Canal Eletrônico do Investidor) — aba Movimentação
                </p>
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Selecionar arquivo
                </Button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-700">Como exportar o arquivo:</p>
                <p>1. Acesse o CEI em <span className="font-mono">cei.b3.com.br</span></p>
                <p>2. Vá em Extratos → Movimentação</p>
                <p>3. Selecione o período e exporte como Excel (.xlsx)</p>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <FileSpreadsheet className="h-4 w-4 text-slate-500 flex-none" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{fileName}</p>
                  <p className="text-xs text-slate-500">
                    {totalOps} movimentações · {preview.length} ativos
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {preview.map((group) => (
                  <div key={group.ticker}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      onClick={() => setExpandedTicker(expandedTicker === group.ticker ? null : group.ticker)}
                    >
                      {expandedTicker === group.ticker ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-none" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-none" />
                      )}
                      <span className="text-sm font-semibold text-slate-800 w-16 flex-none">{group.ticker}</span>
                      <span className="text-xs text-slate-500 flex-1 truncate">{group.companyName}</span>
                      <Badge variant="secondary" className="text-[10px] flex-none">
                        {ASSET_CLASS_LABEL[group.assetClass] ?? group.assetClass}
                      </Badge>
                      <span className="text-xs text-slate-400 flex-none">{group.operationCount} ops</span>
                    </button>

                    {expandedTicker === group.ticker && (
                      <div className="bg-slate-50 border-t border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-100">
                              <th className="text-left px-4 py-1.5 font-medium">Data</th>
                              <th className="text-left px-2 py-1.5 font-medium">Tipo</th>
                              <th className="text-right px-2 py-1.5 font-medium">Qtd</th>
                              <th className="text-right px-2 py-1.5 font-medium">Preço</th>
                              <th className="text-right px-4 py-1.5 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.operations.map((op, i) => (
                              <tr key={i} className="border-b border-slate-100 last:border-0">
                                <td className="px-4 py-1.5 tabular-nums text-slate-600">
                                  {new Date(op.date).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-2 py-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    op.type === "buy" ? "bg-emerald-100 text-emerald-700" :
                                    op.type === "sell" ? "bg-red-100 text-red-700" :
                                    "bg-slate-100 text-slate-600"
                                  }`}>
                                    {TYPE_LABEL[op.type] ?? op.type}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{op.quantity.toLocaleString("pt-BR")}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                                  {op.unitPrice !== null ? formatCurrency(op.unitPrice) : "—"}
                                </td>
                                <td className="px-4 py-1.5 text-right tabular-nums text-slate-700 font-medium">
                                  {op.totalValue !== null ? formatCurrency(op.totalValue) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800">Importação concluída!</p>
                <p className="text-xs text-slate-500 mt-1">
                  {result.operations} operações · {result.proventos} proventos
                  {result.skipped > 0 ? ` · ${result.skipped} duplicatas ignoradas` : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar importação ({totalOps} ops)
              </Button>
            </>
          )}
          {(step === "upload" || step === "done") && (
            <Button variant={step === "done" ? "default" : "outline"} onClick={() => { onOpenChange(false); reset(); }}>
              {step === "done" ? "Fechar" : "Cancelar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
