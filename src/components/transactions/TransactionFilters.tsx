"use client";

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CategoryCombobox, type CategoryGroup } from "./CategoryCombobox";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";

interface Account { id: string; name: string; bank: string }

export interface Filters {
  account: string;
  category: string;
  type: string;
  search: string;
  dateRange: DateRange;
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

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function setStr(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value === ALL ? "" : value });
  }

  function clear() {
    onChange({
      ...filters,
      account: "",
      category: "",
      type: "",
      search: "",
      // mantém o dateRange atual ao limpar outros filtros
    });
  }

  const hasOtherFilters = filters.account || filters.category || filters.type || filters.search;

  return (
    <div className="space-y-3">
      {/* Linha 1: seletor de período */}
      <DateRangePicker
        value={filters.dateRange}
        onChange={(range) => set("dateRange", range)}
      />

      {/* Linha 2: filtros adicionais */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-xs">Conta</Label>
          <Select value={filters.account || ALL} onValueChange={(v) => setStr("account", v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as contas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[220px]">
          <Label className="text-xs">Categoria</Label>
          <CategoryCombobox
            groups={categories}
            value={filters.category || "__all__"}
            onSelect={(id) => setStr("category", id)}
            placeholder="Todas"
            filterMode
            size="sm"
            className="w-full"
          />
        </div>

        <div className="space-y-1 min-w-[140px]">
          <Label className="text-xs">Tipo</Label>
          <Select value={filters.type || ALL} onValueChange={(v) => setStr("type", v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value="debit">Débito</SelectItem>
              <SelectItem value="credit">Crédito</SelectItem>
              <SelectItem value="transfer_out">Transf. saída</SelectItem>
              <SelectItem value="transfer_in">Transf. entrada</SelectItem>
              <SelectItem value="investment">Investimento</SelectItem>
              <SelectItem value="refund">Reembolso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[180px]">
          <Label className="text-xs">Busca</Label>
          <Input
            placeholder="Descrição..."
            value={filters.search}
            onChange={(e) => setStr("search", e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {hasOtherFilters && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-8 gap-1 text-muted-foreground">
            <X className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
