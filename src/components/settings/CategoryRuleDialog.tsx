"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CategoryCombobox, type CategoryGroup } from "@/components/transactions/CategoryCombobox";

export interface RuleToEdit {
  id: string;
  categoryId: string;
  pattern: string;
  matchType: string;
  priority: number;
  applyToFuture: boolean;
  applyToAll: boolean;
}

interface TestResult {
  count: number;
  samples: { id: string; description: string; amount: number; date: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: RuleToEdit | null;
  onSave: (data: Omit<RuleToEdit, "id"> & { id?: string }) => Promise<void>;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CategoryRuleDialog({ open, onOpenChange, editing, onSave }: Props) {
  const [categoryId, setCategoryId] = useState("");
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<"exact" | "contains" | "regex">("contains");
  const [priority, setPriority] = useState(0);
  const [applyToFuture, setApplyToFuture] = useState(true);
  const [applyToAll, setApplyToAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [regexError, setRegexError] = useState("");

  const { data: categories = [] } = useQuery<CategoryGroup[]>({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (editing) {
      setCategoryId(editing.categoryId);
      setPattern(editing.pattern);
      setMatchType(editing.matchType as "exact" | "contains" | "regex");
      setPriority(editing.priority);
      setApplyToFuture(editing.applyToFuture);
      setApplyToAll(editing.applyToAll);
    } else {
      setCategoryId("");
      setPattern("");
      setMatchType("contains");
      setPriority(0);
      setApplyToFuture(true);
      setApplyToAll(false);
    }
    setTestResult(null);
    setRegexError("");
  }, [editing, open]);

  function validateRegex(p: string): boolean {
    try { new RegExp(p); setRegexError(""); return true; }
    catch (e) { setRegexError(String(e)); return false; }
  }

  function handlePatternChange(v: string) {
    setPattern(v);
    setTestResult(null);
    if (matchType === "regex") validateRegex(v);
    else setRegexError("");
  }

  function handleMatchTypeChange(v: "exact" | "contains" | "regex") {
    setMatchType(v);
    setRegexError("");
    setTestResult(null);
    if (v === "regex" && pattern) validateRegex(pattern);
  }

  async function handleTest() {
    if (!pattern.trim()) return;
    if (matchType === "regex" && !validateRegex(pattern)) return;

    setTesting(true);
    try {
      const url = editing?.id
        ? `/api/category-rules/${editing.id}/test`
        : `/api/category-rules/preview-test`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: editing?.id ? undefined : JSON.stringify({ pattern, matchType }),
      });
      if (res.ok) {
        const data = await res.json() as TestResult;
        setTestResult(data);
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!categoryId || !pattern.trim()) return;
    if (matchType === "regex" && !validateRegex(pattern)) return;
    setSaving(true);
    try {
      await onSave({ id: editing?.id, categoryId, pattern: pattern.trim(), matchType, priority, applyToFuture, applyToAll });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar regra" : "Nova regra de categorização"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Categoria destino</Label>
            <CategoryCombobox
              groups={categories}
              value={categoryId}
              onSelect={setCategoryId}
              placeholder="Selecionar categoria"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Padrão</Label>
              <Input
                value={pattern}
                onChange={(e) => handlePatternChange(e.target.value)}
                placeholder={
                  matchType === "exact" ? "NUBANK PAGAMENTO" :
                  matchType === "contains" ? "SPOTIFY" :
                  "^IFOOD.*"
                }
                className={regexError ? "border-destructive" : ""}
              />
              {regexError && <p className="text-xs text-destructive">{regexError}</p>}
              <p className="text-xs text-muted-foreground">
                {matchType === "exact" && "Deve ser idêntico ao nome normalizado da transação (maiúsculas, sem acentos)."}
                {matchType === "contains" && "A transação deve conter este texto (maiúsculas, sem acentos)."}
                {matchType === "regex" && "Expressão regular aplicada ao nome normalizado da transação."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de match</Label>
              <Select value={matchType} onValueChange={(v) => handleMatchTypeChange(v as "exact" | "contains" | "regex")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exato</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Prioridade <span className="text-muted-foreground font-normal">(maior = aplicada primeiro)</span></Label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              className="w-24"
            />
          </div>

          <div className="space-y-2">
            <Label>Escopo de aplicação</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={applyToFuture}
                  onCheckedChange={(v) => setApplyToFuture(!!v)}
                />
                <span className="text-sm">Aplicar automaticamente a novas importações</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={applyToAll}
                  onCheckedChange={(v) => setApplyToAll(!!v)}
                />
                <span className="text-sm">Aplicar retroativamente a transações existentes</span>
              </label>
            </div>
          </div>

          {/* Preview de teste */}
          {pattern.trim() && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Teste da regra</Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleTest}
                  disabled={testing || !pattern.trim() || !!regexError}
                >
                  {testing ? "Testando…" : "Testar agora"}
                </Button>
              </div>
              {testResult && (
                <div className="rounded-md border p-3 space-y-2 text-sm">
                  <p className="font-medium">
                    {testResult.count === 0
                      ? "Nenhuma transação corresponde a este padrão."
                      : `${testResult.count} transação(ões) correspondem.`}
                  </p>
                  {testResult.samples.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate max-w-[280px]">{s.description}</span>
                      <Badge variant="outline" className="ml-2 flex-shrink-0">
                        {fmt.format(s.amount)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!categoryId || !pattern.trim() || !!regexError || saving}>
            {saving ? "Salvando…" : "Salvar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
