"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface DataPoint {
  id: string;
  name: string;
  color: string;
  total: number;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload: DataPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background shadow-md px-3 py-2 text-sm space-y-0.5">
      <p className="font-medium">{d.name}</p>
      <p className="text-muted-foreground">{fmt.format(d.total)}</p>
    </div>
  );
}

export function ExpensesByCategoryChart({ data }: { data: DataPoint[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      Sem despesas categorizadas no mês
    </div>
  );

  return (
    <div className="flex gap-4 items-center">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={80}
            dataKey="total"
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legenda lateral com barras de proporção */}
      <div className="flex-1 space-y-2 min-w-0">
        {(() => {
          const total = data.reduce((s, d) => s + d.total, 0);
          return data.slice(0, 6).map((d) => (
            <div key={d.id} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="truncate text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-medium tabular-nums flex-shrink-0">{fmt.format(d.total)}</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(d.total / total) * 100}%`, backgroundColor: d.color }}
                />
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
