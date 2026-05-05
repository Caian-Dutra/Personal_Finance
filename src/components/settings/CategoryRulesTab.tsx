"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, RefreshCw, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CategoryRuleDialog, type RuleToEdit } from "./CategoryRuleDialog";

interface Rule {
  id: string;
  pattern: string;
  matchType: string;
  priority: number;
  applyToFuture: boolean;
  applyToAll: boolean;
  hitCount: number;
  createdAt: string;
  categoryId: string;
  category: { id: string; name: string; color: string; icon: string };
}

const matchTypeLabel: Record<string, string> = {
  exact: "Exato",
  contains: "Contém",
  regex: "Regex",
};

const matchTypeBadge: Record<string, string> = {
  exact: "bg-blue-100 text-blue-700",
  contains: "bg-amber-100 text-amber-700",
  regex: "bg-purple-100 text-purple-700",
};

export function CategoryRulesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RuleToEdit | null>(null);
  const [applyingRules, setApplyingRules] = useState(false);

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ["category-rules"],
    queryFn: () => fetch("/api/category-rules").then((r) => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Omit<RuleToEdit, "id"> & { id?: string }) => {
      const { id, ...body } = data;
      const url = id ? `/api/category-rules/${id}` : "/api/category-rules";
      const method = id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-rules"] });
      toast.success(editing ? "Regra atualizada" : "Regra criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/category-rules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-rules"] });
      toast.success("Regra excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function applyAllRules() {
    if (!window.confirm("Aplicar todas as regras às transações existentes não categorizadas manualmente? Esta ação pode sobrescrever categorizações automáticas.")) return;
    setApplyingRules(true);
    try {
      const res = await fetch("/api/categorize/apply-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwriteManual: false }),
      });
      const data = await res.json() as { total: number; updated: number };
      toast.success(`${data.updated} de ${data.total} transações categorizadas`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch {
      toast.error("Erro ao aplicar regras");
    } finally {
      setApplyingRules(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditing({
      id: rule.id,
      categoryId: rule.categoryId,
      pattern: rule.pattern,
      matchType: rule.matchType,
      priority: rule.priority,
      applyToFuture: rule.applyToFuture,
      applyToAll: rule.applyToAll,
    });
    setDialogOpen(true);
  }

  function confirmDelete(rule: Rule) {
    if (!window.confirm(`Excluir a regra "${rule.pattern}"?`)) return;
    deleteMutation.mutate(rule.id);
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">Regras de categorização</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rules.length === 0 ? "Nenhuma regra criada" : `${rules.length} regra${rules.length > 1 ? "s" : ""}`} · Aplicadas em ordem de prioridade (maior primeiro)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={applyAllRules}
            disabled={applyingRules || rules.length === 0}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${applyingRules ? "animate-spin" : ""}`} />
            Recategorizar transações
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova regra
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <FlaskConical className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma regra criada</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Regras são criadas automaticamente ao categorizar transações,<br />
            ou você pode criar manualmente aqui.
          </p>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Criar primeira regra
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-center">#</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead className="w-44">Categoria</TableHead>
                <TableHead className="w-24 text-center">Prioridade</TableHead>
                <TableHead className="w-20 text-center">Usos</TableHead>
                <TableHead className="w-28">Escopo</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule, idx) => (
                <TableRow key={rule.id}>
                  <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono break-all">
                      {rule.pattern}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${matchTypeBadge[rule.matchType] ?? ""}`}>
                      {matchTypeLabel[rule.matchType] ?? rule.matchType}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: rule.category.color }} />
                      <span className="text-sm truncate max-w-[140px]">{rule.category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs tabular-nums">
                      {rule.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {rule.hitCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {rule.applyToFuture && <span>✓ Futuras</span>}
                      {rule.applyToAll && <span>✓ Retroativa</span>}
                      {!rule.applyToFuture && !rule.applyToAll && <span className="text-muted-foreground/60">Só manual</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(rule)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => confirmDelete(rule)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CategoryRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={saveMutation.mutateAsync}
      />
    </div>
  );
}
