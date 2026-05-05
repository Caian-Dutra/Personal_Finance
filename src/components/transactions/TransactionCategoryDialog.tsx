"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryCombobox, type CategoryGroup } from "./CategoryCombobox";

interface Transaction {
  id: string;
  description: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
}

interface Props {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Scope = "this" | "future" | "all";

export function TransactionCategoryDialog({ transaction, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState<string>("");
  const [scope, setScope] = useState<Scope>("this");

  const { data: groups = [] } = useQuery<CategoryGroup[]>({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/transactions/${transaction!.id}/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, scope }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao categorizar");
      }
    },
    onSuccess: () => {
      toast.success("Transação categorizada");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
      setCategoryId("");
      setScope("this");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleOpen(isOpen: boolean) {
    if (!isOpen) {
      setCategoryId("");
      setScope("this");
    } else {
      setCategoryId(transaction?.categoryId ?? "");
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Categorizar transação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground truncate">{transaction?.description}</p>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <CategoryCombobox
              groups={groups}
              value={categoryId}
              onSelect={setCategoryId}
              placeholder="Selecionar categoria"
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Aplicar a</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this">Apenas esta transação</SelectItem>
                <SelectItem value="future">Esta e futuras com o mesmo nome</SelectItem>
                <SelectItem value="all">Todas com o mesmo nome (incluindo antigas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!categoryId || mutation.isPending}
          >
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
