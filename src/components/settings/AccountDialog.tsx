"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BANK_CONFIG, ACCOUNT_TYPE_LABELS } from "@/lib/accounts";

interface AccountFormData {
  bank: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: string;
  initialDate: string;
  color: string;
}

interface Account {
  id: string;
  bank: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: number;
  initialDate: string | null;
  color: string;
}

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  onSave: (data: Partial<AccountFormData> & { id?: string }) => Promise<void>;
}

const EMPTY: AccountFormData = {
  bank: "nubank",
  name: "",
  type: "checking",
  currency: "BRL",
  initialBalance: "0",
  initialDate: new Date().toISOString().slice(0, 10),
  color: BANK_CONFIG.nubank.color,
};

export function AccountDialog({ open, onOpenChange, account, onSave }: AccountDialogProps) {
  const [form, setForm] = useState<AccountFormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setForm({
        bank: account.bank,
        name: account.name,
        type: account.type,
        currency: account.currency,
        initialBalance: String(account.initialBalance),
        initialDate: account.initialDate
          ? new Date(account.initialDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        color: account.color,
      });
    } else {
      setForm(EMPTY);
    }
  }, [account, open]);

  function set(field: keyof AccountFormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-fill color when bank changes (only on create)
      if (field === "bank" && !account) {
        next.color = BANK_CONFIG[value]?.color ?? BANK_CONFIG.other.color;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: account?.id,
        ...form,
        initialBalance: form.initialBalance,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const isEdit = Boolean(account);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Adicionar conta"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Banco */}
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Select value={form.bank} onValueChange={(v) => set("bank", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BANK_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: cfg.color }}
                      >
                        {cfg.initial}
                      </span>
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome / Apelido */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Apelido da conta</Label>
            <Input
              id="acc-name"
              placeholder="Ex: Nubank Corrente, Inter CC"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Moeda */}
          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL — Real Brasileiro</SelectItem>
                <SelectItem value="USD">USD — Dólar Americano</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Saldo inicial */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-balance">Saldo inicial</Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={form.initialBalance}
                onChange={(e) => set("initialBalance", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-date">Data do saldo inicial</Label>
              <Input
                id="acc-date"
                type="date"
                value={form.initialDate}
                onChange={(e) => set("initialDate", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Adicionar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
