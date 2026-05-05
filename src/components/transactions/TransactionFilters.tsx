"use client";

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CategoryCombobox, type CategoryGroup } from "./CategoryCombobox";

interface Account {
  id: string;
  name: string;
  bank: string;
}

export interface Filters {
  account: string;
  category: string;
  type: string;
  search: string;
  from: string;
  to: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const ALL = "__all__";

export function TransactionFilters({ filters, onChange }: Props) {
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => fetch("/api/accounts").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: categories = [] } = useQuery<CategoryGroup[]>({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  function set(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value === ALL ? "" : value });
  }

  function clear() {
    onChange({ account: "", category: "", type: "", search: "", from: "", to: "" });
  }

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1 min-w-[160px]">
        <Label className="text-xs">Conta</Label>
        <Select value={filters.account || ALL} onValueChange={(v) => set("account", v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as contas</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 min-w-[220px]">
        <Label className="text-xs">Categoria</Label>
        <CategoryCombobox
          groups={categories}
          value={filters.category || "__all__"}
          onSelect={(id) => set("category", id)}
          placeholder="Todas"
          filterMode
          size="sm"
          className="w-full"
        />
      </div>

      <div className="space-y-1 min-w-[140px]">
        <Label className="text-xs">Tipo</Label>
        <Select value={filters.type || ALL} onValueChange={(v) => set("type", v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="debit">Débito</SelectItem>
            <SelectItem value="credit">Crédito</SelectItem>
            <SelectItem value="transfer_out">Transferência saída</SelectItem>
            <SelectItem value="transfer_in">Transferência entrada</SelectItem>
            <SelectItem value="investment">Investimento</SelectItem>
            <SelectItem value="refund">Reembolso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 min-w-[100px]">
        <Label className="text-xs">De</Label>
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => set("from", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1 min-w-[100px]">
        <Label className="text-xs">Até</Label>
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => set("to", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1 min-w-[180px]">
        <Label className="text-xs">Busca</Label>
        <Input
          placeholder="Descrição..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-8 gap-1 text-muted-foreground">
          <X className="h-3 w-3" />
          Limpar
        </Button>
      )}
    </div>
  );
}
