"use client";

import { useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Tipos e Presets ───────────────────────────────────────────────────────────

export type DatePreset = "month" | "3m" | "6m" | "1y" | "max" | "custom";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  preset: DatePreset;
}

const PRESETS: { value: DatePreset; label: string; short: string }[] = [
  { value: "month", label: "Este mês",  short: "Mês"   },
  { value: "3m",    label: "3 meses",   short: "3m"    },
  { value: "6m",    label: "Semestre",  short: "6m"    },
  { value: "1y",    label: "1 ano",     short: "1 ano" },
  { value: "max",   label: "Máximo",    short: "Máx."  },
];

export function getRange(preset: DatePreset, custom?: { from: string; to: string }): DateRange {
  const now = new Date();
  const to  = now.toISOString().slice(0, 10);

  if (preset === "custom" && custom) return { from: custom.from, to: custom.to, preset };

  let from: string;
  switch (preset) {
    case "month":
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      break;
    case "3m":
      from = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
      break;
    case "6m":
      from = new Date(now.getTime() - 180 * 86_400_000).toISOString().slice(0, 10);
      break;
    case "1y":
      from = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
      break;
    case "max":
    default:
      from = "2000-01-01";
  }
  return { from, to, preset };
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
    .format(new Date(iso + "T12:00:00Z"));

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo,   setCustomTo]   = useState(value.to);

  function selectPreset(preset: DatePreset) {
    onChange(getRange(preset));
    if (preset !== "custom") setOpen(false);
  }

  function applyCustom() {
    if (!customFrom || !customTo || customFrom > customTo) return;
    onChange({ from: customFrom, to: customTo, preset: "custom" });
    setOpen(false);
  }

  const isCustom = value.preset === "custom";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-2 font-normal text-sm", className)}
        >
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden sm:inline text-muted-foreground">
            {fmtDate(value.from)} – {fmtDate(value.to)}
          </span>
          <span className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
            "bg-primary/10 text-primary",
          )}>
            {isCustom ? "Custom" : (PRESETS.find((p) => p.value === value.preset)?.short ?? value.preset)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-3 space-y-3" align="start">
        {/* Preset chips */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => selectPreset(p.value)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium border transition-colors",
                value.preset === p.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Separador */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Período personalizado</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-sm"
                onFocus={() => {/* mantém open */}}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input
                type="date"
                value={customTo}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            disabled={!customFrom || !customTo || customFrom > customTo}
            onClick={applyCustom}
          >
            Aplicar período
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
