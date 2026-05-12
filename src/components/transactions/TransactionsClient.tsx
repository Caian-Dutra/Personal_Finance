"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFilters, type Filters } from "./TransactionFilters";
import { TransactionTable, type TxRow } from "./TransactionTable";
import { InternalTransferDetectDialog } from "./InternalTransferDetectDialog";
import { getRange } from "@/components/ui/date-range-picker";
import type { TransferPair } from "@/lib/internalTransferDetector";

interface ApiResponse {
  transactions: TxRow[];
  total: number;
  page: number;
  totalPages: number;
}

function defaultFilters(): Filters {
  return {
    account:   "",
    category:  "",
    type:      "",
    search:    "",
    dateRange: getRange("1y"),   // último ano por padrão
  };
}

function buildQuery(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  if (filters.account)  params.set("account",  filters.account);
  if (filters.category) params.set("category", filters.category);
  if (filters.type)     params.set("type",     filters.type);
  if (filters.search)   params.set("search",   filters.search);
  params.set("from", filters.dateRange.from);
  params.set("to",   filters.dateRange.to);
  params.set("page", String(page));
  return params.toString();
}

export function TransactionsClient() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [detectOpen, setDetectOpen] = useState(false);
  const [detectPairs, setDetectPairs] = useState<TransferPair[]>([]);
  const [detecting, setDetecting] = useState(false);

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

  async function handleDetect() {
    setDetecting(true);
    try {
      const res = await fetch("/api/transactions/detect-internal", { method: "POST" });
      const result = await res.json() as { pairs: TransferPair[] };
      setDetectPairs(result.pairs);
      setDetectOpen(true);
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1">
          <TransactionFilters filters={filters} onChange={handleFiltersChange} />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs flex-shrink-0 mt-6"
          onClick={handleDetect}
          disabled={detecting}
        >
          <Link2 className={`h-3.5 w-3.5 ${detecting ? "animate-pulse" : ""}`} />
          {detecting ? "Detectando…" : "Detectar transferências"}
        </Button>
      </div>

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

      <InternalTransferDetectDialog
        open={detectOpen}
        onOpenChange={setDetectOpen}
        pairs={detectPairs}
      />
    </div>
  );
}
