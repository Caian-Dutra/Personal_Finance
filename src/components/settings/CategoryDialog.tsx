"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const COLORS = [
  "#E74C3C", "#E67E22", "#F39C12", "#27AE60", "#1ABC9C",
  "#3498DB", "#2E6DA4", "#9B59B6", "#EC407A", "#607D8B",
  "#8D6E63", "#546E7A", "#95A5A6", "#BDC3C7",
];

const ICONS = [
  "circle", "wallet", "briefcase", "home", "car", "utensils",
  "heart-pulse", "graduation-cap", "tv", "shirt", "laptop",
  "trending-up", "landmark", "gift", "paw-print", "arrow-right-left",
  "shopping-cart", "coffee", "bike", "fuel", "bus", "zap", "droplets",
  "wifi", "shield", "pill", "dumbbell", "play-circle", "plane",
];

export interface CategoryParent {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface CategoryToEdit {
  id: string;
  name: string;
  icon: string;
  color: string;
  isIncome: boolean;
  parentId: string | null;
  isSystem: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CategoryToEdit | null;
  parents: CategoryParent[];
  onSave: (data: {
    id?: string;
    name: string;
    icon: string;
    color: string;
    isIncome: boolean;
    parentId: string | null;
  }) => Promise<void>;
}

export function CategoryDialog({ open, onOpenChange, editing, parents, onSave }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("circle");
  const [color, setColor] = useState("#95A5A6");
  const [isIncome, setIsIncome] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setIcon(editing.icon);
      setColor(editing.color);
      setIsIncome(editing.isIncome);
      setParentId(editing.parentId);
    } else {
      setName("");
      setIcon("circle");
      setColor("#95A5A6");
      setIsIncome(false);
      setParentId(null);
    }
  }, [editing, open]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: editing?.id, name, icon, color, isIncome, parentId });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Streaming, Mercado..."
            />
          </div>

          {!editing && (
            <div className="space-y-1">
              <Label>Categoria pai (opcional)</Label>
              <Select value={parentId ?? "__none__"} onValueChange={(v) => setParentId(v === "__none__" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma (categoria raiz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma (categoria raiz)</SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!parentId && (
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={isIncome ? "income" : "expense"} onValueChange={(v) => setIsIncome(v === "income")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Ícone</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {ICONS.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
