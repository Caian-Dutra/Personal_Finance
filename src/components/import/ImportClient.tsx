"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, CheckCircle2, AlertTriangle, ArrowLeft, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BANK_CONFIG } from "@/lib/accounts";
import type { PreviewRow } from "@/app/api/import/preview/route";

type Step = "select" | "preview" | "success";

interface Account { id: string; name: string; bank: string; currency: string }

const BANKS = [
  { key: "nubank", ...BANK_CONFIG.nubank },
  { key: "inter",  ...BANK_CONFIG.inter },
  { key: "picpay", ...BANK_CONFIG.picpay },
  { key: "wise",   ...BANK_CONFIG.wise },
];

function fmtCurrency(v: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(iso + "T12:00:00Z"));
}

export function ImportClient() {
  const [step, setStep]               = useState<Step>("select");
  const [bank, setBank]               = useState<string>("");
  const [accountId, setAccountId]     = useState<string>("");
  const [file, setFile]               = useState<File | null>(null);
  const [dragging, setDragging]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [preview, setPreview]         = useState<{ transactions: PreviewRow[]; batchId: string } | null>(null);
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [result, setResult]           = useState<{ imported: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => fetch("/api/accounts").then((r) => r.json() as Promise<Account[]>),
  });

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  // ── Step 1 → Preview ────────────────────────────────────────────────────────
  async function handlePreview() {
    if (!bank || !accountId || !file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bank", bank);
      fd.append("accountId", accountId);

      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      const data = await res.json() as { transactions?: PreviewRow[]; batchId?: string; error?: string };

      if (!res.ok) { toast.error(data.error ?? "Erro ao processar arquivo"); return; }

      setPreview({ transactions: data.transactions!, batchId: data.batchId! });
      // Pre-select all non-duplicate rows
      const sel = new Set(
        data.transactions!
          .map((_, i) => i)
          .filter((i) => !data.transactions![i].isDuplicate)
      );
      setSelected(sel);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 → Confirm ────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!preview || !accountId || !bank || !file) return;
    setLoading(true);
    try {
      const selectedRows = Array.from(selected).map((i) => preview.transactions[i]);
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: preview.batchId,
          accountId,
          bank,
          fileName: file.name,
          transactions: selectedRows,
        }),
      });
      const data = await res.json() as { imported?: number; skipped?: number; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Erro ao importar"); return; }
      setResult({ imported: data.imported!, skipped: data.skipped! });
      setStep("success");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("select"); setBank(""); setAccountId(""); setFile(null);
    setPreview(null); setSelected(new Set()); setResult(null);
  }

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    if (!preview) return;
    const nonDupes = preview.transactions.map((_, i) => i).filter((i) => !preview.transactions[i].isDuplicate);
    const allSelected = nonDupes.every((i) => selected.has(i));
    setSelected(allSelected ? new Set() : new Set(nonDupes));
  }

  // ── STEP: SUCCESS ───────────────────────────────────────────────────────────
  if (step === "success" && result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Importação concluída!</h2>
        <p className="text-slate-500">
          <span className="font-medium text-slate-900">{result.imported}</span> transação(ões) importada(s).
          {result.skipped > 0 && <> · <span className="text-slate-400">{result.skipped} ignorada(s) (duplicadas)</span></>}
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={reset}>Importar mais</Button>
          <Button onClick={() => window.location.href = "/transactions"}>Ver transações</Button>
        </div>
      </div>
    );
  }

  // ── STEP: PREVIEW ───────────────────────────────────────────────────────────
  if (step === "preview" && preview) {
    const rows = preview.transactions;
    const dupeCount = rows.filter((r) => r.isDuplicate).length;
    const selRows   = Array.from(selected).map((i) => rows[i]);
    const totalDebit  = selRows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);
    const totalCredit = selRows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const allNonDupesSelected = rows
      .map((_, i) => i)
      .filter((i) => !rows[i].isDuplicate)
      .every((i) => selected.has(i));

    const acc = accounts.find((a) => a.id === accountId);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setStep("select")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Pré-visualização — {rows.length} transação(ões) encontrada(s)
            </h2>
            <p className="text-xs text-slate-500">{file?.name} · {acc?.name}</p>
          </div>
        </div>

        {dupeCount > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              {dupeCount} transação(ões) já existem no banco e foram desmarcadas automaticamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
          <div><span className="text-slate-500">Selecionadas:</span> <span className="font-medium">{selected.size}</span></div>
          <div><span className="text-slate-500">Débitos:</span> <span className="font-medium text-red-600">{fmtCurrency(totalDebit)}</span></div>
          <div><span className="text-slate-500">Créditos:</span> <span className="font-medium text-green-600">{fmtCurrency(totalCredit)}</span></div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <ScrollArea className="h-[420px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={allNonDupesSelected}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">Data</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Descrição</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-600 whitespace-nowrap">Valor</th>
                  <th className="w-24 px-3 py-2.5 text-center font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => !row.isDuplicate && toggleRow(i)}
                    className={`transition-colors ${
                      row.isDuplicate
                        ? "bg-slate-50 opacity-50 cursor-not-allowed"
                        : selected.has(i)
                          ? "bg-blue-50 cursor-pointer hover:bg-blue-50"
                          : "hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(i)}
                        disabled={row.isDuplicate}
                        onCheckedChange={() => toggleRow(i)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                    <td className="px-3 py-2.5 text-slate-900 max-w-xs truncate">
                      {row.description}
                      {row.originalCurrency && (
                        <span className="ml-1 text-xs text-slate-400">
                          ({row.originalAmount?.toFixed(2)} {row.originalCurrency})
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${
                      row.amount < 0 ? "text-red-600" : "text-green-600"
                    }`}>
                      {fmtCurrency(row.amount, acc?.currency ?? "BRL")}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          já importado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          novo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep("select")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0 || loading}>
            {loading ? "Importando..." : `Confirmar importação (${selected.size})`}
          </Button>
        </div>
      </div>
    );
  }

  // ── STEP: SELECT ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-8">
      {/* 1. Banco */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">1. Selecione o banco</h2>
        <div className="grid grid-cols-4 gap-3">
          {BANKS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBank(b.key)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                bank === b.key
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white"
                style={{ backgroundColor: b.color }}
              >
                {b.initial}
              </div>
              <span className="text-xs font-medium text-slate-700">{b.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Conta */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">2. Selecione a conta</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma conta cadastrada.{" "}
            <a href="/settings" className="underline text-slate-700">Cadastre uma conta</a> antes de importar.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {accounts
              .filter((a) => !bank || a.bank === bank)
              .map((a) => {
                const cfg = BANK_CONFIG[a.bank] ?? BANK_CONFIG.other;
                return (
                  <button
                    key={a.id}
                    onClick={() => { setAccountId(a.id); if (!bank) setBank(a.bank); }}
                    className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                      accountId === a.id
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: cfg.color }}
                    >
                      {cfg.initial}
                    </div>
                    <span className="text-sm font-medium text-slate-800 truncate">{a.name}</span>
                  </button>
                );
              })}
          </div>
        )}
      </section>

      {/* 3. Arquivo */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">3. Envie o arquivo</h2>
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <FileText className="h-5 w-5 text-slate-400 flex-none" />
            <span className="text-sm text-slate-700 flex-1 truncate">{file.name}</span>
            <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
            <button onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 cursor-pointer transition-colors ${
              dragging ? "border-slate-400 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Upload className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">Arraste o arquivo aqui</p>
            <p className="text-xs text-slate-400 mt-1">ou clique para selecionar · CSV, PDF, XLSX</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.pdf,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
      </section>

      <Button
        className="w-full"
        disabled={!bank || !accountId || !file || loading}
        onClick={handlePreview}
      >
        {loading ? "Processando..." : "Pré-visualizar →"}
      </Button>
    </div>
  );
}
