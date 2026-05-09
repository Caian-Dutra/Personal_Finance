"use client";

import { useState, useEffect } from "react";
import { Search, ChevronRight, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/accounts";
import type { FipeResult } from "@/types";

type VehicleType = "carros" | "motos" | "caminhoes";

interface FipeBrand { codigo: string; nome: string }
interface FipeModel { codigo: number; nome: string }
interface FipeYear { codigo: string; nome: string }
interface FipePrice { Valor: string; Marca: string; Modelo: string; AnoModelo: number; Combustivel: string }

type Step = "type" | "brand" | "model" | "year" | "price";

function parseFipeValue(valor: string): number {
  return parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim());
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? "Erro FIPE");
  }
  return res.json() as Promise<T>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: FipeResult) => void;
}

export function FipeSearchDialog({ open, onOpenChange, onConfirm }: Props) {
  const [step, setStep] = useState<Step>("type");
  const [vehicleType, setVehicleType] = useState<VehicleType>("carros");
  const [brands, setBrands] = useState<FipeBrand[]>([]);
  const [models, setModels] = useState<FipeModel[]>([]);
  const [years, setYears] = useState<FipeYear[]>([]);
  const [priceData, setPriceData] = useState<FipePrice | null>(null);

  const [selectedBrand, setSelectedBrand] = useState<FipeBrand | null>(null);
  const [selectedModel, setSelectedModel] = useState<FipeModel | null>(null);
  const [selectedYear, setSelectedYear] = useState<FipeYear | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("type");
    setVehicleType("carros");
    setBrands([]);
    setModels([]);
    setYears([]);
    setPriceData(null);
    setSelectedBrand(null);
    setSelectedModel(null);
    setSelectedYear(null);
    setSearch("");
    setError(null);
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  async function loadBrands() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FipeBrand[]>(`/api/fipe/brands?type=${vehicleType}`);
      setBrands(data.sort((a, b) => a.nome.localeCompare(b.nome)));
      setStep("brand");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadModels(brand: FipeBrand) {
    setSelectedBrand(brand);
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FipeModel[]>(`/api/fipe/models?type=${vehicleType}&brand=${brand.codigo}`);
      setModels(data.sort((a, b) => a.nome.localeCompare(b.nome)));
      setStep("model");
      setSearch("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadYears(model: FipeModel) {
    setSelectedModel(model);
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FipeYear[]>(
        `/api/fipe/years?type=${vehicleType}&brand=${selectedBrand!.codigo}&model=${model.codigo}`
      );
      setYears(data);
      setStep("year");
      setSearch("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPrice(year: FipeYear) {
    setSelectedYear(year);
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FipePrice>(
        `/api/fipe/price?type=${vehicleType}&brand=${selectedBrand!.codigo}&model=${selectedModel!.codigo}&year=${year.codigo}`
      );
      setPriceData(data);
      setStep("price");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!priceData || !selectedBrand || !selectedModel || !selectedYear) return;
    onConfirm({
      brandCode: selectedBrand.codigo,
      modelCode: String(selectedModel.codigo),
      yearCode: selectedYear.codigo,
      brandName: priceData.Marca,
      modelName: priceData.Modelo,
      year: priceData.AnoModelo,
      fuel: priceData.Combustivel,
      value: parseFipeValue(priceData.Valor),
      vehicleType,
    });
    onOpenChange(false);
  }

  const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
    carros: "Carro",
    motos: "Moto",
    caminhoes: "Caminhão",
  };

  const filteredBrands = brands.filter((b) =>
    b.nome.toLowerCase().includes(search.toLowerCase())
  );
  const filteredModels = models.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );

  const stepTitle: Record<Step, string> = {
    type: "Tipo de veículo",
    brand: "Selecionar marca",
    model: "Selecionar modelo",
    year: "Selecionar ano/combustível",
    price: "Valor FIPE",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            {stepTitle[step]}
          </DialogTitle>
          {step !== "type" && (
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {selectedBrand && (
                <Badge variant="secondary" className="text-xs">{selectedBrand.nome}</Badge>
              )}
              {selectedModel && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <Badge variant="secondary" className="text-xs">{selectedModel.nome}</Badge>
                </>
              )}
              {selectedYear && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <Badge variant="secondary" className="text-xs">{selectedYear.nome}</Badge>
                </>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {step === "type" && (
            <div className="space-y-3">
              <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carros">Carro</SelectItem>
                  <SelectItem value="motos">Moto</SelectItem>
                  <SelectItem value="caminhoes">Caminhão</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={loadBrands} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Buscar marcas
              </Button>
            </div>
          )}

          {(step === "brand" || step === "model") && (
            <>
              <Input
                placeholder={step === "brand" ? "Filtrar marca..." : "Filtrar modelo..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <div className="overflow-y-auto flex-1 rounded-md border border-slate-200 divide-y divide-slate-100">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : step === "brand" ? (
                  filteredBrands.length === 0 ? (
                    <p className="p-4 text-sm text-slate-400 text-center">Nenhuma marca encontrada</p>
                  ) : (
                    filteredBrands.map((b) => (
                      <button
                        key={b.codigo}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between"
                        onClick={() => loadModels(b)}
                      >
                        {b.nome}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    ))
                  )
                ) : (
                  filteredModels.length === 0 ? (
                    <p className="p-4 text-sm text-slate-400 text-center">Nenhum modelo encontrado</p>
                  ) : (
                    filteredModels.map((m) => (
                      <button
                        key={m.codigo}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between"
                        onClick={() => loadYears(m)}
                      >
                        {m.nome}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    ))
                  )
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep(step === "brand" ? "type" : "brand")}>
                Voltar
              </Button>
            </>
          )}

          {step === "year" && (
            <>
              <div className="overflow-y-auto flex-1 rounded-md border border-slate-200 divide-y divide-slate-100">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : (
                  years.map((y) => (
                    <button
                      key={y.codigo}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between"
                      onClick={() => loadPrice(y)}
                    >
                      {y.nome}
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  ))
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep("model")}>
                Voltar
              </Button>
            </>
          )}

          {step === "price" && priceData && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Marca / Modelo</span>
                  <span className="font-medium text-slate-900">{priceData.Marca} {priceData.Modelo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Ano / Combustível</span>
                  <span className="font-medium text-slate-900">{priceData.AnoModelo} · {priceData.Combustivel}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-500 text-sm">Valor FIPE</span>
                  <span className="text-xl font-bold text-emerald-600 tabular-nums">
                    {formatCurrency(parseFipeValue(priceData.Valor))}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Tipo: {VEHICLE_TYPE_LABELS[vehicleType]}
              </p>
            </div>
          )}
        </div>

        {step === "price" && priceData && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStep("year")}>
              Voltar
            </Button>
            <Button onClick={handleConfirm}>
              <Check className="mr-2 h-4 w-4" />
              Usar este valor
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
