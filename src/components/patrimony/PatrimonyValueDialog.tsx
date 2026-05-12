"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FipeSearchDialog } from "./FipeSearchDialog";
import { formatCurrency } from "@/lib/accounts";
import type { PatrimonyItemFull, FipeResult } from "@/types";

interface FipePrice { Valor: string; Marca: string; Modelo: string; AnoModelo: number; Combustivel: string }

function parseFipeValue(valor: string): number {
  return parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim());
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PatrimonyItemFull | null;
  onSave: (itemId: string, data: { date: string; value: number; source: string }) => Promise<void>;
  onDelete: (itemId: string, valueId: string) => Promise<void>;
}

export function PatrimonyValueDialog({ open, onOpenChange, item, onSave, onDelete }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [fetchingFipe, setFetchingFipe] = useState(false);
  const [fipeOpen, setFipeOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setValue("");
      setSource("manual");
    }
  }, [open]);

  // Auto-fetch FIPE using saved codes — no search dialog needed
  async function autoFetchFipe() {
    if (!item?.fipeBrandCode || !item.fipeModelCode || !item.fipeYearCode || !item.fipeVehicleType) return;
    setFetchingFipe(true);
    try {
      const params = new URLSearchParams({
        type: item.fipeVehicleType,
        brand: item.fipeBrandCode,
        model: item.fipeModelCode,
        year: item.fipeYearCode,
      });
      const res = await fetch(`/api/fipe/price?${params}`);
      if (!res.ok) throw new Error("Erro ao consultar FIPE");
      const data = await res.json() as FipePrice;
      setValue(String(parseFipeValue(data.Valor)));
      setSource("fipe");
      setDate(new Date().toISOString().slice(0, 10));
    } catch {
      // silently ignore — user can enter manually
    } finally {
      setFetchingFipe(false);
    }
  }

  // Manual FIPE search (for vehicles without codes linked yet)
  function handleFipeResult(result: FipeResult) {
    setValue(String(result.value));
    setSource("fipe");
    setDate(new Date().toISOString().slice(0, 10));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    const v = parseFloat(value.replace(",", "."));
    if (isNaN(v) || !date) return;
    setSaving(true);
    try {
      await onSave(item.id, { date, value: v, source });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(valueId: string) {
    if (!item) return;
    setDeletingId(valueId);
    try {
      await onDelete(item.id, valueId);
    } finally {
      setDeletingId(null);
    }
  }

  const hasFipeCodes = !!(
    item?.fipeBrandCode && item.fipeModelCode && item.fipeYearCode && item.fipeVehicleType
  );
  const isVehicle = item?.type === "vehicle";

  const fmt = new Intl.DateTimeFormat("pt-BR");
  const sortedHistory = item
    ? [...item.valueHistory].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    : [];

  const sourceLabels: Record<string, string> = {
    manual: "Manual",
    fipe: "FIPE",
    appraisal: "Avaliação",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Histórico de valor — {item?.name}</DialogTitle>
            {hasFipeCodes && (
              <p className="text-xs text-slate-500 mt-1">
                FIPE vinculada: {item?.fipeBrand} {item?.fipeModel} {item?.fipeYear}
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 min-h-0">
            <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50">
              <p className="text-sm font-medium text-slate-700">Registrar novo valor</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fonte</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="appraisal">Avaliação</SelectItem>
                      <SelectItem value="fipe">FIPE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Valor estimado (R$)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: 280000"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      required
                    />
                    {isVehicle && hasFipeCodes && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={autoFetchFipe}
                        disabled={fetchingFipe}
                        title="Buscar valor FIPE atual automaticamente"
                      >
                        {fetchingFipe ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {isVehicle && !hasFipeCodes && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFipeOpen(true)}
                        title="Buscar valor FIPE manualmente"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isVehicle && hasFipeCodes && (
                    <p className="text-[11px] text-slate-400">
                      <RefreshCw className="inline h-3 w-3 mr-1" />
                      Clique em{" "}
                      <span className="font-medium text-slate-600">atualizar</span>{" "}
                      para buscar o valor FIPE atual de {item?.fipeBrand} {item?.fipeModel}
                    </p>
                  )}
                  {isVehicle && !hasFipeCodes && (
                    <p className="text-[11px] text-slate-400">
                      Veículo sem FIPE vinculada. Clique em{" "}
                      <span className="font-medium text-slate-600">buscar</span>{" "}
                      para vincular — nas próximas atualizações será automático.
                    </p>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Salvando..." : "Registrar valor"}
              </Button>
            </form>

            {sortedHistory.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Histórico</p>
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {sortedHistory.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 tabular-nums">
                          {formatCurrency(v.value)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {fmt.format(new Date(v.date))} · {sourceLabels[v.source] ?? v.source}
                        </p>
                      </div>
                      <button
                        className="text-xs text-slate-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                        onClick={() => handleDelete(v.id)}
                        disabled={deletingId === v.id}
                      >
                        {deletingId === v.id ? "..." : "Remover"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fallback manual search — only shown when no FIPE codes are saved */}
      <FipeSearchDialog
        open={fipeOpen}
        onOpenChange={setFipeOpen}
        onConfirm={handleFipeResult}
      />
    </>
  );
}
