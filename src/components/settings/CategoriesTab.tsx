"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, PlusCircle, Pencil, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryDialog, type CategoryToEdit, type CategoryParent } from "./CategoryDialog";

interface ChildCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  isIncome: boolean;
  isSystem: boolean;
  parentId: string;
  _count: { transactions: number; rules: number };
}

interface ParentCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  isIncome: boolean;
  isSystem: boolean;
  parentId: null;
  children: ChildCategory[];
  _count: { transactions: number; rules: number };
}

async function fetchCategories(): Promise<ParentCategory[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Erro ao carregar categorias");
  return res.json() as Promise<ParentCategory[]>;
}

export function CategoriesTab() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryToEdit | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      name: string;
      icon: string;
      color: string;
      isIncome: boolean;
      parentId: string | null;
    }) => {
      const { id, ...body } = data;
      const url = id ? `/api/categories/${id}` : "/api/categories";
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
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate(parentId?: string) {
    setEditing(parentId ? { id: "", name: "", icon: "circle", color: "#95A5A6", isIncome: false, parentId, isSystem: false } : null);
    setDialogOpen(true);
  }

  function openEdit(cat: ParentCategory | ChildCategory) {
    setEditing({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isIncome: cat.isIncome,
      parentId: cat.parentId ?? null,
      isSystem: cat.isSystem,
    });
    setDialogOpen(true);
  }

  function confirmDelete(cat: ParentCategory | ChildCategory) {
    const txCount = cat._count.transactions;
    if (txCount > 0) {
      toast.error(`Existem ${txCount} transações com esta categoria. Recategorize-as primeiro.`);
      return;
    }
    if (!window.confirm(`Excluir "${cat.name}"?`)) return;
    deleteMutation.mutate(cat.id);
  }

  const parents: CategoryParent[] = categories.map((c) => ({ id: c.id, name: c.name, isSystem: c.isSystem }));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const income = categories.filter((c) => c.isIncome);
  const expense = categories.filter((c) => !c.isIncome);

  function renderGroup(label: string, items: ParentCategory[]) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mt-4 mb-1">{label}</p>
        <div className="rounded-xl border divide-y overflow-hidden">
          {items.map((cat) => {
            const isOpen = expanded.has(cat.id);
            return (
              <div key={cat.id}>
                {/* Parent row */}
                <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors group">
                  <button
                    onClick={() => toggleExpand(cat.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {isOpen
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />
                    }
                  </button>
                  <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium flex-1">{cat.name}</span>
                  <span className="text-xs text-muted-foreground hidden group-hover:inline">
                    {cat.children.length} sub · {cat._count.transactions} tx
                  </span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openCreate(cat.id)} title="Adicionar subcategoria">
                      <PlusCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(cat)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => confirmDelete(cat)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Children */}
                {isOpen && cat.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2 px-3 py-2 pl-10 bg-muted/20 hover:bg-muted/40 transition-colors group border-t">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                    <span className="text-sm flex-1">{child.name}</span>
                    {child._count.rules > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground hidden group-hover:flex">
                        <Tag className="h-3 w-3" />{child._count.rules} regra{child._count.rules > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground hidden group-hover:inline">
                      {child._count.transactions} tx
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(child)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => confirmDelete(child)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Categorias</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{categories.length} categorias raiz</p>
        </div>
        <Button size="sm" onClick={() => openCreate()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova categoria
        </Button>
      </div>

      {renderGroup("Receitas", income)}
      {renderGroup("Despesas", expense)}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing?.id ? editing : null}
        parents={parents}
        onSave={saveMutation.mutateAsync}
      />
    </div>
  );
}
