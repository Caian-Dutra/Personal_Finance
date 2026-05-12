"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload, CheckCircle2, AlertTriangle, ArrowLeft, FileText, X,
  ChevronRight, SkipForward, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BANK_CONFIG } from "@/lib/accounts";
import type { PreviewRow } from "@/app/api/import/preview/route";
import { InternalTransferDetectDialog } from "@/components/transactions/InternalTransferDetectDialog";
import type { TransferPair } from "@/lib/internalTransferDetector";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Step = "select" | "preview" | "done";

type QueueStatus = "pending" | "processing" | "done" | "skipped" | "error";

interface QueueItem {
  file: File;
  status: QueueStatus;
  result?: { imported: number; skipped: number; autoLinked: number };
  error?: string;
}

interface Account { id: string; name: string; bank: string; currency: string }

// ── Constantes ────────────────────────────────────────────────────────────────

const BANKS = [
  { key: "nubank", ...BANK_CONFIG.nubank },
  { key: "inter",  ...BANK_CONFIG.inter  },
  { key: "picpay", ...BANK_CONFIG.picpay },
  { key: "wise",   ...BANK_CONFIG.wise   },
];

const ACCEPTED = ".csv,.pdf,.xlsx,.xls";
const MAX_FILES = 20;

// ── Formatação ────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(iso + "T12:00:00Z"));

// ── Status badge na fila ──────────────────────────────────────────────────────

function QueueBadge({ status, index }: { status: QueueStatus; index: number }) {
  if (status === "done")       return <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
  if (status === "error")      return <X className="h-4 w-4 text-red-500 flex-shrink-0" />;
  if (status === "skipped")    return <SkipForward className="h-4 w-4 text-slate-400 flex-shrink-0" />;
  if (status === "processing") return <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />;
  return <span className="h-4 w-4 flex-shrink-0 flex items-center justify-center text-xs text-slate-400">{index + 1}</span>;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ImportClient() {
  const [step, setStep]       = useState<Step>("select");
  const [bank, setBank]       = useState("");
  const [accountId, setAccountId] = useState("");
  const [queue, setQueue]     = useState<QueueItem[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estado do preview do arquivo atual
  const [preview, setPreview]   = useState<{ transactions: PreviewRow[]; batchId: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Dialog de transferências — agrega todas as sugestões da fila
  const [detectOpen, setDetectOpen]           = useState(false);
  const [detectPairs, setDetectPairs]         = useState<TransferPair[]>([]);
  const [detectAutoLinked, setDetectAutoLinked] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => fetch("/api/accounts").then((r) => r.json() as Promise<Account[]>),
  });

  // ── Helpers de fila ────────────────────────────────────────────────────────

  function updateQueue(idx: number, patch: Partial<QueueItem>) {
    setQueue((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles).slice(0, MAX_FILES - queue.length);
    if (!arr.length) return;
    setQueue((prev) => [
      ...prev,
      ...arr.map((f) => ({ file: f, status: "pending" as QueueStatus })),
    ]);
  }

  function removeFile(idx: number) {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length]);

  // ── Iniciar fila ───────────────────────────────────────────────────────────

  async function startQueue() {
    if (!bank || !accountId || queue.length === 0) return;
    setQueueIdx(0);
    await processFile(0, queue);
  }

  // ── Preview de um arquivo ──────────────────────────────────────────────────

  async function processFile(idx: number, currentQueue: QueueItem[]) {
    const item = currentQueue[idx];
    if (!item) { finalize(currentQueue); return; }

    updateQueue(idx, { status: "processing" });
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", item.file);
      fd.append("bank", bank);
      fd.append("accountId", accountId);

      const res  = await fetch("/api/import/preview", { method: "POST", body: fd });
      const data = await res.json() as { transactions?: PreviewRow[]; batchId?: string; error?: string };

      if (!res.ok || !data.transactions) {
        updateQueue(idx, { status: "error", error: data.error ?? "Erro ao processar" });
        toast.error(`${item.file.name}: ${data.error ?? "Erro ao processar"}`);
        advanceTo(idx + 1, currentQueue);
        return;
      }

      setPreview({ transactions: data.transactions, batchId: data.batchId! });
      setSelected(new Set(
        data.transactions.map((_, i) => i).filter((i) => !data.transactions![i].isDuplicate)
      ));
      setQueueIdx(idx);
      setStep("preview");
    } catch {
      updateQueue(idx, { status: "error", error: "Erro de rede" });
      advanceTo(idx + 1, currentQueue);
    } finally {
      setLoading(false);
    }
  }

  // ── Confirmar arquivo atual ────────────────────────────────────────────────

  async function handleConfirm() {
    if (!preview) return;
    const item = queue[queueIdx];
    setLoading(true);
    try {
      const selectedRows = Array.from(selected).map((i) => preview.transactions[i]);
      const res  = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: preview.batchId,
          accountId,
          bank,
          fileName: item.file.name,
          transactions: selectedRows,
        }),
      });
      const data = await res.json() as {
        imported?: number; skipped?: number; error?: string;
        autoLinked?: number; suggestions?: TransferPair[];
      };

      if (!res.ok) {
        updateQueue(queueIdx, { status: "error", error: data.error ?? "Erro ao importar" });
        toast.error(`${item.file.name}: ${data.error ?? "Erro ao importar"}`);
      } else {
        const result = {
          imported: data.imported ?? 0,
          skipped:  data.skipped  ?? 0,
          autoLinked: data.autoLinked ?? 0,
        };
        updateQueue(queueIdx, { status: "done", result });

        // Acumula sugestões de transferências
        if (data.suggestions?.length) {
          setDetectPairs((prev) => [...prev, ...data.suggestions!]);
          setDetectAutoLinked((prev) => prev + (data.autoLinked ?? 0));
        }
      }

      const nextQueue = queue.map((q, i) =>
        i === queueIdx
          ? { ...q, status: (res.ok ? "done" : "error") as QueueStatus,
              result: res.ok ? { imported: data.imported ?? 0, skipped: data.skipped ?? 0, autoLinked: data.autoLinked ?? 0 } : undefined }
          : q
      );
      setQueue(nextQueue);
      advanceTo(queueIdx + 1, nextQueue);
    } finally {
      setLoading(false);
    }
  }

  // ── Pular arquivo atual ────────────────────────────────────────────────────

  function handleSkip() {
    const nextQueue = queue.map((q, i) =>
      i === queueIdx ? { ...q, status: "skipped" as QueueStatus } : q
    );
    setQueue(nextQueue);
    advanceTo(queueIdx + 1, nextQueue);
  }

  // ── Avançar para próximo item ──────────────────────────────────────────────

  function advanceTo(nextIdx: number, currentQueue: QueueItem[]) {
    setPreview(null);
    setSelected(new Set());

    const nextPending = currentQueue.findIndex((q, i) => i >= nextIdx && q.status === "pending");
    if (nextPending === -1) {
      finalize(currentQueue);
    } else {
      setQueueIdx(nextPending);
      void processFile(nextPending, currentQueue);
    }
  }

  // ── Finalizar fila ─────────────────────────────────────────────────────────

  function finalize(finalQueue: QueueItem[]) {
    setQueue(finalQueue);
    setStep("done");
    if (detectPairs.length > 0) setDetectOpen(true);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    setStep("select");
    setBank("");
    setAccountId("");
    setQueue([]);
    setQueueIdx(0);
    setPreview(null);
    setSelected(new Set());
    setDetectPairs([]);
    setDetectAutoLinked(0);
  }

  // ── Toggle de linhas no preview ────────────────────────────────────────────

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
    const allSel = nonDupes.every((i) => selected.has(i));
    setSelected(allSel ? new Set() : new Set(nonDupes));
  }

  // ── Barra de fila (reutilizada em preview e done) ─────────────────────────

  function QueueBar() {
    return (
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {queue.map((item, i) => (
          <div key={i} className="flex items-center gap-1 flex-shrink-0">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-colors ${
                i === queueIdx && step === "preview"
                  ? "border-blue-300 bg-blue-50 text-blue-800 font-medium"
                  : item.status === "done"    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : item.status === "error"   ? "border-red-200 bg-red-50 text-red-700"
                  : item.status === "skipped" ? "border-slate-200 bg-slate-100 text-slate-400"
                  : "border-slate-200 text-slate-500"
              }`}
            >
              <QueueBadge status={item.status} index={i} />
              <span className="max-w-[120px] truncate">{item.file.name}</span>
            </div>
            {i < queue.length - 1 && (
              <ChevronRight className="h-3 w-3 text-slate-300 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: DONE
  // ══════════════════════════════════════════════════════════════════════════

  if (step === "done") {
    const totalImported   = queue.reduce((s, q) => s + (q.result?.imported   ?? 0), 0);
    const totalSkippedDup = queue.reduce((s, q) => s + (q.result?.skipped    ?? 0), 0);
    const totalAutoLinked = queue.reduce((s, q) => s + (q.result?.autoLinked ?? 0), 0);
    const doneCount    = queue.filter((q) => q.status === "done").length;
    const skippedCount = queue.filter((q) => q.status === "skipped").length;
    const errorCount   = queue.filter((q) => q.status === "error").length;

    return (
      <>
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Fila concluída!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {doneCount} arquivo{doneCount !== 1 ? "s" : ""} processado{doneCount !== 1 ? "s" : ""}
                {skippedCount > 0 && ` · ${skippedCount} pulado${skippedCount !== 1 ? "s" : ""}`}
                {errorCount   > 0 && ` · ${errorCount} com erro`}
              </p>
            </div>

            {/* Totais globais */}
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{totalImported}</p>
                <p className="text-muted-foreground text-xs">transações importadas</p>
              </div>
              {totalSkippedDup > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-400">{totalSkippedDup}</p>
                  <p className="text-muted-foreground text-xs">duplicatas ignoradas</p>
                </div>
              )}
              {totalAutoLinked > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{totalAutoLinked}</p>
                  <p className="text-muted-foreground text-xs">transf. vinculadas</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={reset}>Nova importação</Button>
              <Button onClick={() => { window.location.href = "/transactions"; }}>Ver transações</Button>
            </div>
          </div>

          {/* Resultado por arquivo */}
          <div className="rounded-xl border divide-y overflow-hidden max-w-lg mx-auto">
            {queue.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <QueueBadge status={item.status} index={i} />
                <span className="text-sm flex-1 truncate">{item.file.name}</span>
                {item.status === "done" && item.result && (
                  <span className="text-xs text-muted-foreground">
                    {item.result.imported} importadas
                    {item.result.skipped > 0 && ` · ${item.result.skipped} duplicadas`}
                  </span>
                )}
                {item.status === "skipped" && (
                  <span className="text-xs text-muted-foreground">pulado</span>
                )}
                {item.status === "error" && (
                  <span className="text-xs text-red-500">{item.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <InternalTransferDetectDialog
          open={detectOpen}
          onOpenChange={setDetectOpen}
          pairs={detectPairs}
          autoLinked={detectAutoLinked}
        />
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: PREVIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (step === "preview" && preview) {
    const rows     = preview.transactions;
    const dupeCount = rows.filter((r) => r.isDuplicate).length;
    const selRows   = Array.from(selected).map((i) => rows[i]);
    const totalDebit  = selRows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);
    const totalCredit = selRows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const allNonDupesSelected = rows
      .map((_, i) => i)
      .filter((i) => !rows[i].isDuplicate)
      .every((i) => selected.has(i));
    const acc      = accounts.find((a) => a.id === accountId);
    const item     = queue[queueIdx];
    const remaining = queue.filter((q, i) => i > queueIdx && q.status === "pending").length;

    return (
      <div className="space-y-4">
        {/* Barra de fila */}
        {queue.length > 1 && (
          <div className="space-y-1">
            <QueueBar />
            <p className="text-xs text-muted-foreground">
              Arquivo {queueIdx + 1} de {queue.length}
              {remaining > 0 && ` · ${remaining} restante${remaining !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setStep("select"); setPreview(null); }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          <div>
            <h2 className="text-sm font-semibold">
              Pré-visualização — {rows.length} transação(ões)
            </h2>
            <p className="text-xs text-muted-foreground">{item?.file.name} · {acc?.name}</p>
          </div>
        </div>

        {dupeCount > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              {dupeCount} transação(ões) já existem e foram desmarcadas automaticamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-6 rounded-lg border px-4 py-3 text-sm">
          <div><span className="text-muted-foreground">Selecionadas:</span> <span className="font-medium">{selected.size}</span></div>
          <div><span className="text-muted-foreground">Débitos:</span> <span className="font-medium text-red-600">{fmtCurrency(totalDebit)}</span></div>
          <div><span className="text-muted-foreground">Créditos:</span> <span className="font-medium text-green-600">{fmtCurrency(totalCredit)}</span></div>
        </div>

        {/* Tabela */}
        <div className="rounded-xl border overflow-hidden">
          <ScrollArea className="h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox checked={allNonDupesSelected} onCheckedChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600 whitespace-nowrap">Data</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Descrição</th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-600 whitespace-nowrap">Valor</th>
                  <th className="w-24 px-3 py-2.5 text-center font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => !row.isDuplicate && toggleRow(i)}
                    className={`transition-colors ${
                      row.isDuplicate
                        ? "bg-slate-50 opacity-50 cursor-not-allowed"
                        : selected.has(i)
                          ? "bg-blue-50 cursor-pointer"
                          : "hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(i)} disabled={row.isDuplicate} onCheckedChange={() => toggleRow(i)} />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row.date)}</td>
                    <td className="px-3 py-2.5 max-w-xs truncate">
                      {row.description}
                      {row.originalCurrency && (
                        <span className="ml-1 text-xs text-muted-foreground">
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
                        <Badge variant="secondary" className="text-[11px]">já importado</Badge>
                      ) : (
                        <Badge className="text-[11px] bg-green-50 text-green-700 border-green-200 hover:bg-green-50">novo</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={handleSkip} disabled={loading}>
            <SkipForward className="mr-1 h-4 w-4" />
            {remaining > 0 ? "Pular → próximo" : "Pular"}
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0 || loading}>
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando…</>
              : remaining > 0
                ? `Confirmar e avançar (${selected.size})`
                : `Confirmar importação (${selected.size})`
            }
          </Button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: SELECT
  // ══════════════════════════════════════════════════════════════════════════

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
                    <span className="text-sm font-medium truncate">{a.name}</span>
                  </button>
                );
              })}
          </div>
        )}
      </section>

      {/* 3. Arquivos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">3. Envie os arquivos</h2>
          {queue.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {queue.length}/{MAX_FILES} arquivo{queue.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Zona de drop */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors ${
            dragging
              ? "border-slate-400 bg-slate-50"
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <Upload className="h-7 w-7 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">Arraste arquivos aqui</p>
          <p className="text-xs text-slate-400 mt-0.5">ou clique para selecionar · CSV, PDF, XLSX · até {MAX_FILES} arquivos</p>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* Lista de arquivos na fila */}
        {queue.length > 0 && (
          <div className="space-y-1.5">
            {queue.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
              >
                <FileText className="h-4 w-4 text-slate-400 flex-none" />
                <span className="text-sm text-slate-700 flex-1 truncate">{item.file.name}</span>
                <span className="text-xs text-slate-400 flex-none">{(item.file.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-slate-400 hover:text-slate-600 flex-none"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Button
        className="w-full"
        disabled={!bank || !accountId || queue.length === 0 || loading}
        onClick={startQueue}
      >
        {loading
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando…</>
          : queue.length === 1
            ? "Pré-visualizar →"
            : `Iniciar fila (${queue.length} arquivo${queue.length !== 1 ? "s" : ""}) →`
        }
      </Button>
    </div>
  );
}
