"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface CategoryGroup {
  id: string;
  name: string;
  color: string;
  icon: string;
  isIncome: boolean;
  children?: { id: string; name: string; color: string; icon: string }[];
}

interface Props {
  groups: CategoryGroup[];
  value: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  /** Se true, adiciona "Todas" e "Sem categoria" no topo (modo filtro) */
  filterMode?: boolean;
  className?: string;
  size?: "sm" | "default";
}

function findSelected(groups: CategoryGroup[], id: string) {
  if (!id || id === "__all__" || id === "uncategorized") return null;
  for (const g of groups) {
    if (g.id === id) return { name: g.name, color: g.color, parentName: null };
    for (const c of g.children ?? []) {
      if (c.id === id) return { name: c.name, color: c.color, parentName: g.name };
    }
  }
  return null;
}

const expenseGroups = [
  "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
  "Lazer e Entretenimento", "Vestuário", "Tecnologia",
  "Animais de Estimação", "Impostos e Taxas", "Investimentos",
  "Transferência Interna", "Outros",
];

export function CategoryCombobox({ groups, value, onSelect, placeholder, filterMode, className, size = "default" }: Props) {
  const [open, setOpen] = useState(false);

  const selected = findSelected(groups, value);

  const incomeGroups = groups.filter((g) => g.isIncome);
  const debitGroups = groups.filter((g) => !g.isIncome && expenseGroups.includes(g.name));
  const otherGroups = groups.filter((g) => !g.isIncome && !expenseGroups.includes(g.name));

  function handleSelect(id: string) {
    onSelect(id);
    setOpen(false);
  }

  const triggerH = size === "sm" ? "h-8 text-sm" : "h-9 text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", triggerH, className)}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selected.color }}
                />
                <span className="truncate">
                  {selected.parentName ? (
                    <span className="text-muted-foreground mr-1">{selected.parentName} /</span>
                  ) : null}
                  {selected.name}
                </span>
              </>
            ) : value === "uncategorized" ? (
              <span className="text-muted-foreground">Sem categoria</span>
            ) : value === "__all__" || !value ? (
              <span className="text-muted-foreground">{placeholder ?? "Selecionar categoria"}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder ?? "Selecionar categoria"}</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar categoria..." />
          <CommandList>
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>

            {filterMode && (
              <>
                <CommandGroup>
                  <CommandItem value="__all__todas" onSelect={() => handleSelect("__all__")}>
                    <Check className={cn("mr-2 h-4 w-4", (!value || value === "__all__") ? "opacity-100" : "opacity-0")} />
                    Todas as categorias
                  </CommandItem>
                  <CommandItem value="uncategorized-sem" onSelect={() => handleSelect("uncategorized")}>
                    <Check className={cn("mr-2 h-4 w-4", value === "uncategorized" ? "opacity-100" : "opacity-0")} />
                    <Tag className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                    Sem categoria
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {incomeGroups.length > 0 && (
              <>
                <CommandGroup heading="Receitas">
                  {incomeGroups.map((g) =>
                    g.children?.length ? (
                      g.children.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${g.name} ${c.name}`}
                          onSelect={() => handleSelect(c.id)}
                          className="pl-5"
                        >
                          <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", value === c.id ? "opacity-100" : "opacity-0")} />
                          <span
                            className="mr-2 h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="flex flex-col leading-tight">
                            <span className="text-xs text-muted-foreground">{g.name}</span>
                            <span>{c.name}</span>
                          </span>
                        </CommandItem>
                      ))
                    ) : (
                      <CommandItem
                        key={g.id}
                        value={g.name}
                        onSelect={() => handleSelect(g.id)}
                      >
                        <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", value === g.id ? "opacity-100" : "opacity-0")} />
                        <span
                          className="mr-2 h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: g.color }}
                        />
                        {g.name}
                      </CommandItem>
                    )
                  )}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {debitGroups.length > 0 && (
              <CommandGroup heading="Despesas">
                {debitGroups.map((g) =>
                  g.children?.length ? (
                    g.children.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${g.name} ${c.name}`}
                        onSelect={() => handleSelect(c.id)}
                        className="pl-5"
                      >
                        <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", value === c.id ? "opacity-100" : "opacity-0")} />
                        <span
                          className="mr-2 h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="flex flex-col leading-tight">
                          <span className="text-xs text-muted-foreground">{g.name}</span>
                          <span>{c.name}</span>
                        </span>
                      </CommandItem>
                    ))
                  ) : (
                    <CommandItem
                      key={g.id}
                      value={g.name}
                      onSelect={() => handleSelect(g.id)}
                    >
                      <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", value === g.id ? "opacity-100" : "opacity-0")} />
                      <span
                        className="mr-2 h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                      {g.name}
                    </CommandItem>
                  )
                )}
              </CommandGroup>
            )}

            {otherGroups.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Outros">
                  {otherGroups.map((g) =>
                    g.children?.length ? (
                      g.children.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${g.name} ${c.name}`}
                          onSelect={() => handleSelect(c.id)}
                          className="pl-5"
                        >
                          <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", value === c.id ? "opacity-100" : "opacity-0")} />
                          <span
                            className="mr-2 h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="flex flex-col leading-tight">
                            <span className="text-xs text-muted-foreground">{g.name}</span>
                            <span>{c.name}</span>
                          </span>
                        </CommandItem>
                      ))
                    ) : (
                      <CommandItem
                        key={g.id}
                        value={g.name}
                        onSelect={() => handleSelect(g.id)}
                      >
                        <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", value === g.id ? "opacity-100" : "opacity-0")} />
                        <span
                          className="mr-2 h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: g.color }}
                        />
                        {g.name}
                      </CommandItem>
                    )
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
