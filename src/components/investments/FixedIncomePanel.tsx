"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/accounts";

const SUBTYPE_LABELS: Record<string, string> = {
  savings_box: "Caixinha",
  cdb: "CDB",
  lci: "LCI",
  lca: "LCA",
  tesouro_selic: "Tesouro Selic",
  tesouro_ipca: "Tesouro IPCA+",
  tesouro_prefixado: "Tesouro Prefixado",
  debenture: "Debênture",
  cri_cra: "CRI/CRA",
  previdencia: "Previdência",
};

const INDEXER_LABELS: Record<string, string> = {
  CDI: "CDI",
  IPCA: "IPCA+",
  SELIC: "SELIC",
  prefixado: "Prefixado",
  rendimento_diario: "Rendimento Diário",
};

interface FixedIncomeAsset {
  id: string;
  name: string;
  subtype: string;
  issuer: string;
  indexer: string;
  rate: number | null;
  investedValue: number;
  currentValue: number;
  purchaseDate: string;
  maturityDate: string | null;
  isActive: boolean;
  latestBalance?: number;
}

interface NewAssetForm {
  name: string;
  subtype: string;
  issuer: string;
  indexer: string;
  rate: string;
  investedValue: string;
  purchaseDate: string;
  maturityDate: string;
}

function emptyForm(): NewAssetForm {
  return {
    name: "",
    subtype: "cdb",
    issuer: "",
    indexer: "CDI",
    rate: "",
    investedValue: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    maturityDate: "",
  };
}

export function FixedIncomePanel() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewAssetForm>(emptyForm);

  const { data: assets = [], isLoading } = useQuery<FixedIncomeAsset[]>({
    queryKey: ["investments-fixed-income"],
    queryFn: () => fetch("/api/investments/fixed-income").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/investments/fixed-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments-fixed-income"] });
      toast.success("Ativo de renda fixa cadastrado.");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set(f: keyof NewAssetForm, v: string) {
    setForm((prev) => ({ ...prev, [f]: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await createMutation.mutateAsync({
      name: form.name,
      subtype: form.subtype,
      issuer: form.issuer,
      indexer: form.indexer,
      rate: form.rate ? parseFloat(form.rate.replace(",", ".")) : null,
      investedValue: form.investedValue ? parseFloat(form.investedValue.replace(",", ".")) : 0,
      purchaseDate: form.purchaseDate,
      maturityDate: form.maturityDate || null,
    });
  }

  const totalApplied = assets.reduce((s, a) => s + a.investedValue, 0);
  const totalCurrent = assets.reduce((s, a) => s + (a.latestBalance ?? a.currentValue), 0);
  const totalReturn = totalCurrent - totalApplied;

  const fmt = new Intl.DateTimeFormat("pt-BR");

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 mr-4">
          {[
            { label: "Total aplicado", value: formatCurrency(totalApplied), color: "text-slate-900" },
            { label: "Saldo atual", value: formatCurrency(totalCurrent), color: "text-slate-900" },
            { label: "Rendimento", value: formatCurrency(totalReturn), color: totalReturn >= 0 ? "text-emerald-600" : "text-red-600" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-400">{c.label}</p>
              <p className={`text-lg font-bold tabular-nums ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm()); setDialogOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo ativo
        </Button>
      </div>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-400">Nenhum ativo de renda fixa cadastrado</p>
          <p className="text-xs text-slate-300 mt-1">Adicione CDBs, LCIs, Tesouro Direto ou caixinhas</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 font-medium">
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-3 py-3">Tipo</th>
                  <th className="text-left px-3 py-3 hidden md:table-cell">Indexador</th>
                  <th className="text-right px-3 py-3">Aplicado</th>
                  <th className="text-right px-3 py-3">Saldo</th>
                  <th className="text-right px-3 py-3 hidden lg:table-cell">Rendimento</th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">Vencimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {assets.map((a) => {
                  const balance = a.latestBalance ?? a.currentValue;
                  const ret = balance - a.investedValue;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.issuer}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {SUBTYPE_LABELS[a.subtype] ?? a.subtype}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-slate-500">
                        {INDEXER_LABELS[a.indexer] ?? a.indexer}
                        {a.rate ? ` ${(a.rate * 100).toFixed(0)}%` : ""}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(a.investedValue)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">{formatCurrency(balance)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums hidden lg:table-cell">
                        <span className={ret >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {ret >= 0 ? "+" : ""}{formatCurrency(ret)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-500 hidden lg:table-cell">
                        {a.maturityDate ? fmt.format(new Date(a.maturityDate)) : "Liquidez diária"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo ativo de renda fixa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder='Ex: "CDB Inter 110% CDI"' value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.subtype} onValueChange={(v) => set("subtype", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUBTYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Indexador</Label>
                <Select value={form.indexer} onValueChange={(v) => set("indexer", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDEXER_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Emissor</Label>
                <Input placeholder="Ex: Banco Inter" value={form.issuer} onChange={(e) => set("issuer", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa (ex: 1.1 = 110%)</Label>
                <Input placeholder="1.10" value={form.rate} onChange={(e) => set("rate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor aplicado (R$)</Label>
                <Input placeholder="10000" value={form.investedValue} onChange={(e) => set("investedValue", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de aplicação</Label>
                <Input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento (opcional)</Label>
              <Input type="date" value={form.maturityDate} onChange={(e) => set("maturityDate", e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
