export interface PositionOperation {
  type: string;
  date: string;
  quantity: number;
  unitPrice: number | null;
  totalValue: number | null;
  fees: number;
  affectsPosition: boolean;
  splitRatio: number | null;
}

export interface Position {
  ticker: string;
  assetClass: string;
  quantity: number;
  avgPrice: number;
  totalCost: number;
  brokers: string[];
}

export interface PortfolioPosition extends Position {
  companyName: string;
  currentPrice: number | null;
  marketValue: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
  proventosTotal: number;
  totalReturn: number | null;
  totalReturnPct: number | null;
}

export function calculatePosition(ops: PositionOperation[]): Omit<Position, "ticker" | "assetClass" | "brokers"> {
  let quantity = 0;
  let totalCost = 0;

  const sorted = ops
    .filter((op) => op.affectsPosition)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const op of sorted) {
    if (op.type === "buy" || op.type === "bonus_shares") {
      const cost = op.totalValue ?? (op.unitPrice ?? 0) * op.quantity;
      const feesAdjusted = cost + (op.fees ?? 0);
      totalCost += feesAdjusted;
      quantity += op.quantity;

    } else if (op.type === "sell" || op.type === "redemption") {
      if (quantity > 0) {
        const sellRatio = Math.min(op.quantity / quantity, 1);
        totalCost -= totalCost * sellRatio;
        quantity -= op.quantity;
        if (quantity < 0) quantity = 0;
      }

    } else if (op.type === "split") {
      if (op.splitRatio && op.splitRatio > 1) {
        quantity = quantity * op.splitRatio;
        // totalCost unchanged — just redistributed across more shares
      } else if (op.splitRatio == null && quantity > 0) {
        // splitRatio computed by parser: received shares / previous
        quantity += op.quantity;
      }

    } else if (op.type === "reverse_split") {
      if (op.splitRatio && op.splitRatio > 1) {
        quantity = quantity / op.splitRatio;
      } else if (quantity > 0) {
        quantity -= op.quantity;
        if (quantity < 0) quantity = 0;
      }

    } else if (op.type === "fraction_sale") {
      if (quantity > 0 && op.quantity > 0) {
        const sellRatio = op.quantity / quantity;
        totalCost -= totalCost * sellRatio;
        quantity -= op.quantity;
      }
    }
  }

  // Round to avoid floating point drift
  quantity = Math.round(quantity * 1e6) / 1e6;
  totalCost = Math.round(totalCost * 100) / 100;
  const avgPrice = quantity > 0 ? totalCost / quantity : 0;

  return { quantity, avgPrice, totalCost };
}

// Group operations by ticker and compute all positions
export function calculatePortfolio(
  ops: (PositionOperation & { ticker: string; assetClass: string; broker?: string | null; companyName?: string | null })[],
  proventosByTicker: Map<string, number>,
  quoteByTicker: Map<string, number>
): PortfolioPosition[] {
  const grouped = new Map<string, typeof ops>();
  for (const op of ops) {
    const list = grouped.get(op.ticker) ?? [];
    list.push(op);
    grouped.set(op.ticker, list);
  }

  const positions: PortfolioPosition[] = [];

  for (const [ticker, tickerOps] of Array.from(grouped.entries())) {
    const pos = calculatePosition(tickerOps);
    if (pos.quantity <= 0) continue;

    const brokers = Array.from(new Set(tickerOps.map((o) => o.broker).filter((b): b is string => Boolean(b))));
    const companyName = tickerOps.find((o) => o.companyName)?.companyName ?? "";
    const assetClass = tickerOps[0].assetClass;

    const currentPrice = quoteByTicker.get(ticker) ?? null;
    const marketValue = currentPrice !== null ? currentPrice * pos.quantity : null;
    const gainLoss = marketValue !== null ? marketValue - pos.totalCost : null;
    const gainLossPct = gainLoss !== null && pos.totalCost > 0 ? (gainLoss / pos.totalCost) * 100 : null;

    const proventosTotal = proventosByTicker.get(ticker) ?? 0;
    const totalReturn = gainLoss !== null ? gainLoss + proventosTotal : null;
    const totalReturnPct =
      totalReturn !== null && pos.totalCost > 0 ? (totalReturn / pos.totalCost) * 100 : null;

    positions.push({
      ticker,
      assetClass,
      companyName,
      quantity: pos.quantity,
      avgPrice: pos.avgPrice,
      totalCost: pos.totalCost,
      brokers,
      currentPrice,
      marketValue,
      gainLoss,
      gainLossPct,
      proventosTotal,
      totalReturn,
      totalReturnPct,
    });
  }

  return positions.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
}
