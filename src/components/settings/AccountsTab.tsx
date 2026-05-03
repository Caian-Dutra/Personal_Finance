"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountDialog } from "./AccountDialog";
import { BANK_CONFIG, ACCOUNT_TYPE_LABELS, formatCurrency } from "@/lib/accounts";

interface Account {
  id: string;
  bank: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: number;
  initialDate: string | null;
  color: string;
  currentBalance: number;
  _count: { transactions: number };
}

async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch("/api/accounts");
  if (!res.ok) throw new Error("Erro ao carregar contas");
  return res.json() as Promise<Account[]>;
}

export function AccountsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/accounts", {
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
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta adicionada com sucesso.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Record<string, unknown>) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
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
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSave(data: Record<string, unknown>) {
    const { id, ...rest } = data;
    const payload = {
      ...rest,
      initialBalance: parseFloat(String(rest.initialBalance ?? "0")) || 0,
    };
    if (id) {
      await updateMutation.mutateAsync({ id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setDialogOpen(true);
  }

  function confirmDelete(account: Account) {
    if (
      window.confirm(
        `Excluir "${account.name}"? Esta ação não pode ser desfeita.`
      )
    ) {
      deleteMutation.mutate(account.id);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Contas bancárias</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {accounts.length === 0
              ? "Nenhuma conta cadastrada"
              : `${accounts.length} conta${accounts.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar conta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Wallet className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">Nenhuma conta cadastrada</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Adicione suas contas bancárias para começar
          </p>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar primeira conta
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {accounts.map((account) => {
            const bank = BANK_CONFIG[account.bank] ?? BANK_CONFIG.other;
            const typeLabel = ACCOUNT_TYPE_LABELS[account.type] ?? account.type;
            const balance = formatCurrency(account.currentBalance, account.currency);

            return (
              <div
                key={account.id}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                {/* Ícone do banco */}
                <div
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: bank.color }}
                >
                  {bank.initial}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{account.name}</p>
                  <p className="text-xs text-slate-500">
                    {bank.label} · {typeLabel}
                    {account.currency !== "BRL" && (
                      <span className="ml-1 text-slate-400">({account.currency})</span>
                    )}
                  </p>
                </div>

                {/* Saldo */}
                <div className="text-right flex-none">
                  <p className={`text-sm font-semibold tabular-nums ${
                    account.currentBalance < 0 ? "text-red-600" : "text-slate-900"
                  }`}>
                    {balance}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {account._count.transactions} transação(ões)
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 flex-none">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-slate-700"
                    title="Editar"
                    onClick={() => openEdit(account)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                    title="Excluir"
                    onClick={() => confirmDelete(account)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        onSave={handleSave}
      />
    </div>
  );
}
