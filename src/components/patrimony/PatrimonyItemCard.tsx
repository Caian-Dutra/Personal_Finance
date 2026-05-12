"use client";

import { Building2, Car, Package, Pencil, Trash2, BarChart2, Link2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/accounts";
import type { PatrimonyItemFull } from "@/types";

const TYPE_CONFIG = {
  real_estate: { label: "Imóvel", icon: Building2, color: "#2563EB", bg: "#EFF6FF" },
  vehicle: { label: "Veículo", icon: Car, color: "#16A34A", bg: "#F0FDF4" },
  other: { label: "Outro", icon: Package, color: "#9333EA", bg: "#FAF5FF" },
};

const SUBTYPE_LABELS: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  land: "Terreno",
  commercial: "Sala Comercial",
  car: "Automóvel",
  motorcycle: "Motocicleta",
  truck: "Caminhão",
  boat: "Barco",
  art: "Obra de Arte",
  jewelry: "Joias",
  equipment: "Equipamento",
  other: "Outro",
};

const ACQUISITION_LABELS: Record<string, string> = {
  cash: "À vista",
  financed: "Financiado",
  inheritance: "Herança",
  donation: "Doação",
};

function isValueStale(item: PatrimonyItemFull): boolean {
  if (item.valueHistory.length === 0) return false;
  const sorted = [...item.valueHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastDate = new Date(sorted[0].date);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return lastDate < sixMonthsAgo;
}

interface Props {
  item: PatrimonyItemFull;
  onEdit: (item: PatrimonyItemFull) => void;
  onDelete: (item: PatrimonyItemFull) => void;
  onUpdateValue: (item: PatrimonyItemFull) => void;
  onViewExpenses: (item: PatrimonyItemFull) => void;
}

export function PatrimonyItemCard({ item, onEdit, onDelete, onUpdateValue, onViewExpenses }: Props) {
  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.other;
  const Icon = config.icon;

  const gainLoss = item.currentValue - item.purchaseValue;
  const gainLossPct = item.purchaseValue > 0 ? (gainLoss / item.purchaseValue) * 100 : 0;
  const stale = isValueStale(item);

  const purchaseDateFmt = new Intl.DateTimeFormat("pt-BR", { year: "numeric", month: "short" }).format(
    new Date(item.purchaseDate)
  );

  const sorted = [...item.valueHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastUpdate = sorted.length > 0
    ? new Intl.DateTimeFormat("pt-BR", { year: "numeric", month: "short" }).format(new Date(sorted[0].date))
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4 p-5">
        <div
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
          style={{ backgroundColor: config.bg }}
        >
          <Icon className="h-5 w-5" style={{ color: config.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{item.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {item.subtype ? SUBTYPE_LABELS[item.subtype] ?? item.subtype : config.label}
                {" · "}
                {ACQUISITION_LABELS[item.acquisitionType] ?? item.acquisitionType}
                {" · "}
                {purchaseDateFmt}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-none">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-400 hover:text-slate-700"
                title="Editar"
                onClick={() => onEdit(item)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-400 hover:text-red-600"
                title="Remover"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(item.currentValue)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-xs font-medium tabular-nums ${gainLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {gainLoss >= 0 ? "+" : ""}
                  {formatCurrency(gainLoss)} ({gainLoss >= 0 ? "+" : ""}{gainLossPct.toFixed(1)}%)
                </span>
                <span className="text-xs text-slate-400">
                  vs compra ({formatCurrency(item.purchaseValue)})
                </span>
              </div>
            </div>

            <div className="text-right">
              {stale && (
                <div className="flex items-center gap-1 text-amber-600 mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-[11px] font-medium">Valor desatualizado</span>
                </div>
              )}
              {lastUpdate && (
                <p className="text-[11px] text-slate-400">Atualizado: {lastUpdate}</p>
              )}
              {item.totalExpenses > 0 && (
                <p className="text-[11px] text-slate-400">
                  Custos: {formatCurrency(item.totalExpenses)}
                </p>
              )}
              {item.fipeModel && (
                <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                  {item.fipeBrand} {item.fipeModel} {item.fipeYear}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 bg-slate-50">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => onUpdateValue(item)}
        >
          <BarChart2 className="mr-1.5 h-3 w-3" />
          {stale ? "Atualizar valor" : "Histórico de valor"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => onViewExpenses(item)}
        >
          <Link2 className="mr-1.5 h-3 w-3" />
          Custos vinculados
          {item.linkedExpenses.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 text-[10px] px-1">
              {item.linkedExpenses.length}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
}
