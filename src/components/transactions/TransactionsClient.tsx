"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TransactionFilters, type Filters } from "./TransactionFilters";
import { TransactionTable, type TxRow } from "./TransactionTable";

interface ApiResponse {
  transactions: TxRow[];
  total: number;
  page: number;
  totalPages: number;
}

function defaultFilters(): Filters {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { account: "", category: "", type: "", search: "", from, to };
}

function buildQuery(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  if (filters.account) params.set("account", filters.account);
  if (filters.category) params.set("category", filters.category);
  if (filters.type) params.set("type", filters.type);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(page));
  return params.toString();
}

export function TransactionsClient() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);

  const handleFiltersChange = useCallback((f: Filters) => {
    setFilters(f);
    setPage(1);
  }, []);

  const { data, isFetching } = useQuery<ApiResponse>({
    queryKey: ["transactions", filters, page],
    queryFn: () =>
      fetch(`/api/transactions?${buildQuery(filters, page)}`).then((r) => r.json()),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-4">
      <TransactionFilters filters={filters} onChange={handleFiltersChange} />

      {isFetching && (
        <p className="text-xs text-muted-foreground animate-pulse">Carregando…</p>
      )}

      <TransactionTable
        rows={data?.transactions ?? []}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
