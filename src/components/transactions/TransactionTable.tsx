"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Tag, Trash2, ArrowLeftRight, Copy, ClipboardPaste, X, Link2, Unlink } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TransactionEditDialog } from "./TransactionEditDialog";
import { TransactionCategoryDialog } from "./TransactionCategoryDialog";
import { TransactionDeleteDialog } from "./TransactionDeleteDialog";
import { CategoryCombobox, type CategoryGroup } from "./CategoryCombobox";
import { LinkTransactionDialog } from "./LinkTransactionDialog";

export interface TxRow {
  id: string;
  date: string;
  description: string;
  normalizedName: string;
  amount: number;
  type: string;
  isInternalTransfer: boolean;
  linkedTransactionId: string | null;
  notes: string | null;
  tags: string;
  categoryId: string | null;
  categoryConfidence: number | null;
  categorySource: string | null;
  account: { id: string; name: string; bank: string; color: string };
  category: { id: string; name: string; color: string; icon: string; parentId: string | null } | null;
}

interface ClipboardCategory {
  id: string;
  name: string;
  color: string;
}

interface Props {
  rows: TxRow[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function TransactionTable({ rows, total, page, totalPages, onPageChange }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTx, setEditTx] = useState<TxRow | null>(null);
  const [categorizeTx, setCategorizeTx] = useState<TxRow | null>(null);
  const [deleteTx, setDeleteTx] = useState<TxRow | null>(null);
  const [linkTx, setLinkTx] = useState<TxRow | null>(null);
  const [bulkCategory, setBulkCategory] = useState("");
  const [clipboard, setClipboard] = useState<ClipboardCategory | null>(null);

  const { data: categories = [] } = useQuery<CategoryGroup[]>({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  // Limpa clipboard com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setClipboard(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function applyCategory(txId: string, categoryId: string) {
    const res = await fetch(`/api/transactions/${txId}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, scope: "this" }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      throw new Error(err.error ?? "Erro ao colar");
    }
  }

  const pasteMutation = useMutation({
    mutationFn: (txId: string) => applyCategory(txId, clipboard!.id),
    onSuccess: () => {
      toast.success(`Categoria "${clipboard?.name}" colada`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const res = await fetch("/api/transactions/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), categoryId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Erro");
      }
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} transações categorizadas`);
      setSelected(new Set());
      setBulkCategory("");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function copyCategory(cat: TxRow["category"]) {
    if (!cat) return;
    setClipboard({ id: cat.id, name: cat.name, color: cat.color });
    toast.success(`"${cat.name}" copiada — clique em 📋 para colar`, { duration: 2500 });
  }

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const unlinkMutation = useMutation({
    mutationFn: (txId: string) =>
      fetch(`/api/transactions/${txId}/unlink`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json() as { error: string }).error);
      }),
    onSuccess: () => {
      toast.success("Vínculo removido");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pasteIsBusy = pasteMutation.isPending;
  const bulkIsBusy = bulkMutation.isPending;

  return (
    <div className="space-y-2">

      {/* ── Clipboard indicator ── */}
      {clipboard && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 text-sm">
          <ClipboardPaste className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="text-muted-foreground">Área de transferência:</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: clipboard.color }} />
            {clipboard.name}
          </span>
          <span className="text-muted-foreground text-xs ml-1">— clique em 📋 em qualquer linha para colar · Esc para limpar</span>
          <button
            onClick={() => setClipboard(null)}
            className="ml-auto text-muted-foreground hover:text-foreground"
            title="Limpar área de transferência"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-2 rounded-md bg-muted text-sm flex-wrap">
          <span className="text-muted-foreground font-medium">{selected.size} selecionadas</span>

          {/* Colar categoria copiada em lote */}
          {clipboard && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs border-dashed border-primary/50 text-primary"
              disabled={bulkIsBusy}
              onClick={() => bulkMutation.mutate(clipboard.id)}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Colar &quot;{clipboard.name}&quot; nas {selected.size}
            </Button>
          )}

          {/* Ou escolher outra categoria */}
          <CategoryCombobox
            groups={categories}
            value={bulkCategory}
            onSelect={setBulkCategory}
            placeholder="Ou categorizar como…"
            size="sm"
            className="w-64"
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!bulkCategory || bulkIsBusy}
            onClick={() => bulkMutation.mutate(bulkCategory)}
          >
            Aplicar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => { setSelected(new Set()); setBulkCategory(""); }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={rows.length > 0 && selected.size === rows.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-28">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-40">Conta</TableHead>
              <TableHead className="w-52">Categoria</TableHead>
              <TableHead className="w-28 text-right">Valor</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Nenhuma transação encontrada.
                </TableCell>
              </TableRow>
            )}
            {rows.map((tx) => {
              const isCredit = tx.amount > 0;
              const tags: string[] = JSON.parse(tx.tags ?? "[]");
              const canPaste = !!clipboard && clipboard.id !== tx.categoryId;

              return (
                <TableRow
                  key={tx.id}
                  className={`group ${selected.has(tx.id) ? "bg-muted/50" : ""} ${canPaste ? "cursor-copy" : ""}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(tx.id)}
                      onCheckedChange={() => toggleOne(tx.id)}
                    />
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate.format(new Date(tx.date))}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium leading-tight">{tx.description}</span>
                      <div className="flex flex-wrap gap-1">
                        {tx.isInternalTransfer && (
                          <Badge
                            variant="secondary"
                            className={`text-xs gap-1 px-1 py-0 ${tx.linkedTransactionId ? "text-blue-700 bg-blue-100" : ""}`}
                          >
                            <ArrowLeftRight className="h-2.5 w-2.5" />
                            {tx.linkedTransactionId ? "Vinculada" : "Interna"}
                          </Badge>
                        )}
                        {tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs px-1 py-0">
                            {t}
                          </Badge>
                        ))}
                        {tx.notes && (
                          <span className="text-xs text-muted-foreground italic">{tx.notes}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tx.account.color }}
                      />
                      <span className="text-sm truncate max-w-[130px]">{tx.account.name}</span>
                    </div>
                  </TableCell>

                  {/* ── Categoria cell com botão de copiar ── */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {tx.category ? (
                        <>
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tx.category.color }}
                          />
                          <span className="text-sm truncate max-w-[140px]">{tx.category.name}</span>
                          <button
                            title="Copiar categoria"
                            onClick={() => copyCategory(tx.category)}
                            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-auto flex-shrink-0"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          onClick={() => setCategorizeTx(tx)}
                        >
                          Sem categoria
                        </button>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        isCredit
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {fmt.format(tx.amount)}
                    </span>
                  </TableCell>

                  {/* ── Ações ── */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Editar"
                        onClick={() => setEditTx(tx)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Categorizar"
                        onClick={() => setCategorizeTx(tx)}
                      >
                        <Tag className="h-3.5 w-3.5" />
                      </Button>

                      {/* Botão de colar — só aparece quando há algo no clipboard */}
                      {clipboard && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-primary hover:text-primary"
                          title={`Colar "${clipboard.name}"`}
                          disabled={pasteIsBusy || clipboard.id === tx.categoryId}
                          onClick={() => pasteMutation.mutate(tx.id)}
                        >
                          <ClipboardPaste className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Vincular / Desvincular transferência interna */}
                      {tx.linkedTransactionId ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-blue-600 hover:text-destructive"
                          title="Desvincular transferência"
                          disabled={unlinkMutation.isPending}
                          onClick={() => unlinkMutation.mutate(tx.id)}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                          title="Vincular como transferência interna"
                          onClick={() => setLinkTx(tx)}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:text-destructive"
                        title="Excluir"
                        onClick={() => setDeleteTx(tx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Paginação ── */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{total} transações no total</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Anterior
            </Button>
            <span>{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              Próxima
            </Button>
          </div>
        )}
      </div>

      <TransactionEditDialog
        transaction={editTx}
        open={!!editTx}
        onOpenChange={(o) => { if (!o) setEditTx(null); }}
      />
      <TransactionCategoryDialog
        transaction={categorizeTx}
        open={!!categorizeTx}
        onOpenChange={(o) => { if (!o) setCategorizeTx(null); }}
      />
      <TransactionDeleteDialog
        transaction={deleteTx}
        open={!!deleteTx}
        onOpenChange={(o) => { if (!o) setDeleteTx(null); }}
      />
      <LinkTransactionDialog
        transaction={linkTx}
        open={!!linkTx}
        onOpenChange={(o) => { if (!o) setLinkTx(null); }}
      />
    </div>
  );
}
