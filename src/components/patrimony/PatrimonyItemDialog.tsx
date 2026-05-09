"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FipeSearchDialog } from "./FipeSearchDialog";
import type { PatrimonyItemFull, FipeResult } from "@/types";

const SUBTYPES: Record<string, { value: string; label: string }[]> = {
  real_estate: [
    { value: "apartment", label: "Apartamento" },
    { value: "house", label: "Casa" },
    { value: "land", label: "Terreno" },
    { value: "commercial", label: "Sala Comercial" },
  ],
  vehicle: [
    { value: "car", label: "Automóvel" },
    { value: "motorcycle", label: "Motocicleta" },
    { value: "truck", label: "Caminhão" },
    { value: "boat", label: "Barco" },
  ],
  other: [
    { value: "art", label: "Obra de Arte" },
    { value: "jewelry", label: "Joias" },
    { value: "equipment", label: "Equipamento" },
    { value: "other", label: "Outro" },
  ],
};

interface FormData {
  name: string;
  type: string;
  subtype: string;
  purchaseDate: string;
  purchaseValue: string;
  acquisitionType: string;
  fipeBrand: string;
  fipeModel: string;
  fipeYear: string;
  fipeFuel: string;
  fipeBrandCode: string;
  fipeModelCode: string;
  fipeYearCode: string;
  fipeVehicleType: string;
  notes: string;
}

function emptyForm(): FormData {
  return {
    name: "",
    type: "real_estate",
    subtype: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseValue: "",
    acquisitionType: "cash",
    fipeBrand: "",
    fipeModel: "",
    fipeYear: "",
    fipeFuel: "",
    fipeBrandCode: "",
    fipeModelCode: "",
    fipeYearCode: "",
    fipeVehicleType: "",
    notes: "",
  };
}

function itemToForm(item: PatrimonyItemFull): FormData {
  return {
    name: item.name,
    type: item.type,
    subtype: item.subtype ?? "",
    purchaseDate: new Date(item.purchaseDate).toISOString().slice(0, 10),
    purchaseValue: String(item.purchaseValue),
    acquisitionType: item.acquisitionType,
    fipeBrand: item.fipeBrand ?? "",
    fipeModel: item.fipeModel ?? "",
    fipeYear: item.fipeYear ? String(item.fipeYear) : "",
    fipeFuel: item.fipeFuel ?? "",
    fipeBrandCode: item.fipeBrandCode ?? "",
    fipeModelCode: item.fipeModelCode ?? "",
    fipeYearCode: item.fipeYearCode ?? "",
    fipeVehicleType: item.fipeVehicleType ?? "",
    notes: item.notes ?? "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PatrimonyItemFull | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

export function PatrimonyItemDialog({ open, onOpenChange, item, onSave }: Props) {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fipeOpen, setFipeOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(item ? itemToForm(item) : emptyForm());
    }
  }, [open, item]);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleFipeResult(result: FipeResult) {
    setForm((prev) => ({
      ...prev,
      fipeBrand: result.brandName,
      fipeModel: result.modelName,
      fipeYear: String(result.year),
      fipeFuel: result.fuel,
      fipeBrandCode: result.brandCode,
      fipeModelCode: result.modelCode,
      fipeYearCode: result.yearCode,
      fipeVehicleType: result.vehicleType,
      // purchaseValue is intentionally NOT filled from FIPE — must be entered manually
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(form.purchaseValue.replace(",", "."));
    if (!form.name || !form.type || !form.purchaseDate || isNaN(value) || !form.acquisitionType) return;

    setSaving(true);
    try {
      await onSave({
        ...(item ? { id: item.id } : {}),
        name: form.name,
        type: form.type,
        subtype: form.subtype || null,
        purchaseDate: form.purchaseDate,
        purchaseValue: value,
        acquisitionType: form.acquisitionType,
        fipeBrand: form.fipeBrand || null,
        fipeModel: form.fipeModel || null,
        fipeYear: form.fipeYear ? parseInt(form.fipeYear) : null,
        fipeFuel: form.fipeFuel || null,
        fipeBrandCode: form.fipeBrandCode || null,
        fipeModelCode: form.fipeModelCode || null,
        fipeYearCode: form.fipeYearCode || null,
        fipeVehicleType: form.fipeVehicleType || null,
        notes: form.notes || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const isVehicle = form.type === "vehicle";
  const subtypes = SUBTYPES[form.type] ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{item ? "Editar bem" : "Cadastrar bem"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nome / apelido</Label>
                <Input
                  placeholder="Ex: Apartamento Centro, Honda CB 500"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => { set("type", v); set("subtype", ""); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="real_estate">Imóvel</SelectItem>
                    <SelectItem value="vehicle">Veículo</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Subtipo</Label>
                <Select value={form.subtype} onValueChange={(v) => set("subtype", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subtypes.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Data de aquisição</Label>
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => set("purchaseDate", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Forma de aquisição</Label>
                <Select value={form.acquisitionType} onValueChange={(v) => set("acquisitionType", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">À vista</SelectItem>
                    <SelectItem value="financed">Financiado</SelectItem>
                    <SelectItem value="inheritance">Herança</SelectItem>
                    <SelectItem value="donation">Doação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Valor de aquisição (R$)</Label>
                <Input
                  placeholder="Ex: 250000"
                  value={form.purchaseValue}
                  onChange={(e) => set("purchaseValue", e.target.value)}
                  required
                />
              </div>
            </div>

            {isVehicle && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Dados FIPE (opcional)</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFipeOpen(true)}
                  >
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                    Buscar na FIPE
                  </Button>
                </div>
                {(form.fipeBrand || form.fipeModel) && (
                  <div className="text-sm text-slate-600 space-y-1">
                    {form.fipeBrand && <p><span className="text-slate-400">Marca:</span> {form.fipeBrand}</p>}
                    {form.fipeModel && <p><span className="text-slate-400">Modelo:</span> {form.fipeModel}</p>}
                    {form.fipeYear && <p><span className="text-slate-400">Ano:</span> {form.fipeYear} · {form.fipeFuel}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Informações adicionais..."
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : item ? "Salvar alterações" : "Cadastrar bem"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <FipeSearchDialog
        open={fipeOpen}
        onOpenChange={setFipeOpen}
        onConfirm={handleFipeResult}
      />
    </>
  );
}
