"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatrimonyChart } from "./PatrimonyChart";
import { PatrimonyItemCard } from "./PatrimonyItemCard";
import { PatrimonyItemDialog } from "./PatrimonyItemDialog";
import { PatrimonyValueDialog } from "./PatrimonyValueDialog";
import { PatrimonyExpensesPanel } from "./PatrimonyExpensesPanel";
import { formatCurrency } from "@/lib/accounts";
import type { PatrimonyItemFull } from "@/types";

async function fetchItems(): Promise<PatrimonyItemFull[]> {
  const res = await fetch("/api/patrimony");
  if (!res.ok) throw new Error("Erro ao carregar patrimônio");
  return res.json() as Promise<PatrimonyItemFull[]>;
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? "Erro desconhecido");
  }
  return res.json();
}

async function apiPatch(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? "Erro desconhecido");
  }
  return res.json();
}

export function PatrimonyClient() {
  const queryClient = useQueryClient();

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PatrimonyItemFull | null>(null);
  const [valueDialogItem, setValueDialogItem] = useState<PatrimonyItemFull | null>(null);
  const [expensesPanelItem, setExpensesPanelItem] = useState<PatrimonyItemFull | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["patrimony"],
    queryFn: fetchItems,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (data.id) {
        const { id, ...rest } = data;
        return apiPatch(`/api/patrimony/${id}`, rest);
      }
      return apiPost("/api/patrimony", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["patrimony"] });
      toast.success(variables.id ? "Bem atualizado." : "Bem cadastrado com sucesso.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/patrimony/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover bem");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony"] });
      toast.success("Bem removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addValueMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { date: string; value: number; source: string } }) =>
      apiPost(`/api/patrimony/${itemId}/values`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony"] });
      toast.success("Valor registrado.");
      setValueDialogItem((prev) => {
        if (!prev) return null;
        const updated = items.find((i) => i.id === prev.id);
        return updated ?? prev;
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteValueMutation = useMutation({
    mutationFn: ({ itemId, valueId }: { itemId: string; valueId: string }) =>
      fetch(`/api/patrimony/${itemId}/values/${valueId}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Erro ao remover valor");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony"] });
      toast.success("Valor removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditingItem(null);
    setItemDialogOpen(true);
  }

  function openEdit(item: PatrimonyItemFull) {
    setEditingItem(item);
    setItemDialogOpen(true);
  }

  function confirmDelete(item: PatrimonyItemFull) {
    if (window.confirm(`Remover "${item.name}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(item.id);
    }
  }

  async function handleSaveItem(data: Record<string, unknown>) {
    await saveMutation.mutateAsync(data);
  }

  async function handleAddValue(itemId: string, data: { date: string; value: number; source: string }) {
    await addValueMutation.mutateAsync({ itemId, data });
  }

  async function handleDeleteValue(itemId: string, valueId: string) {
    await deleteValueMutation.mutateAsync({ itemId, valueId });
  }

  const totalPatrimony = items.reduce((sum, i) => sum + i.currentValue, 0);

  const itemForValueDialog = valueDialogItem
    ? (items.find((i) => i.id === valueDialogItem.id) ?? valueDialogItem)
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-60 rounded-xl bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Patrimônio Físico</h1>
          {items.length > 0 && (
            <p className="text-sm text-slate-500 mt-0.5">
              {items.length} bem(ns) · valor total:{" "}
              <span className="font-semibold text-slate-800">{formatCurrency(totalPatrimony)}</span>
            </p>
          )}
        </div>
        <Button onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Cadastrar bem
        </Button>
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">Evolução do patrimônio físico</p>
          <PatrimonyChart items={items} />
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Building2 className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">Nenhum bem cadastrado</p>
          <p className="text-xs text-slate-400 mt-1 mb-5 max-w-sm">
            Cadastre seus bens físicos (imóveis, veículos, etc.) para acompanhar seu patrimônio total ao longo do tempo.
          </p>
          <Button onClick={openCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Cadastrar primeiro bem
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => (
            <PatrimonyItemCard
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={confirmDelete}
              onUpdateValue={(i) => setValueDialogItem(i)}
              onViewExpenses={(i) => setExpensesPanelItem(i)}
            />
          ))}
        </div>
      )}

      <PatrimonyItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        onSave={handleSaveItem}
      />

      <PatrimonyValueDialog
        open={!!valueDialogItem}
        onOpenChange={(open) => { if (!open) setValueDialogItem(null); }}
        item={itemForValueDialog}
        onSave={handleAddValue}
        onDelete={handleDeleteValue}
      />

      <PatrimonyExpensesPanel
        open={!!expensesPanelItem}
        onOpenChange={(open) => { if (!open) setExpensesPanelItem(null); }}
        item={expensesPanelItem}
        onExpensesChanged={() => queryClient.invalidateQueries({ queryKey: ["patrimony"] })}
      />
    </div>
  );
}
