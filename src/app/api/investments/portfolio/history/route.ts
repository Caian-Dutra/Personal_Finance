import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculatePosition } from "@/lib/investments/position";

const DEFAULT_PROFILE = "default_profile";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const BENCHMARKS = ["BOVA11", "XFIX11"];

interface MonthPoint {
  month: string;          // "YYYY-MM"
  portfolioValue: number;
  portfolioCost: number;
  proventosAccum: number;
  returnPct: number;      // % desde o início (capital gains)
  totalReturnPct: number; // % incluindo proventos
  bova11Pct: number | null;
  xfix11Pct: number | null;
  hasPrices: boolean;
}

function lastDayOfMonth(yearMonth: string): Date {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59)); // last ms of last day
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function monthsBetween(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur <= endMonth) {
    months.push(cur.toISOString().slice(0, 7));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return months;
}

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // All operations
  const ops = await prisma.investmentOperation.findMany({
    where: { profileId: DEFAULT_PROFILE },
    orderBy: { date: "asc" },
  });

  if (ops.length === 0) {
    return Response.json({ months: [], hasPriceHistory: false, tickersWithoutHistory: [] });
  }

  // All tickers in portfolio + benchmarks
  const portfolioTickers = Array.from(new Set(ops.map((o) => o.ticker)));
  const allTickers = [...portfolioTickers, ...BENCHMARKS];

  // Price history — group as Map<ticker, Map<monthKey, latestClose>>
  let rawPrices: { ticker: string; date: Date; close: number }[] = [];
  try {
    rawPrices = await db.priceHistory.findMany({
      where: { ticker: { in: allTickers } },
      orderBy: { date: "asc" },
      select: { ticker: true, date: true, close: true },
    });
  } catch {
    // priceHistory not available yet — return empty history
  }

  // Build month-end price map: ticker → month → close
  const priceByMonth = new Map<string, Map<string, number>>();
  for (const p of rawPrices) {
    const mk = monthKey(new Date(p.date));
    if (!priceByMonth.has(p.ticker)) priceByMonth.set(p.ticker, new Map());
    priceByMonth.get(p.ticker)!.set(mk, p.close); // last entry per month wins (sorted ASC)
  }

  // Proventos — group by (ticker, month)
  let rawProventos: { ticker: string; date: Date; totalValue: number }[] = [];
  try {
    rawProventos = await db.proventoReceived.findMany({
      where: { profileId: DEFAULT_PROFILE },
      select: { ticker: true, date: true, totalValue: true },
      orderBy: { date: "asc" },
    });
  } catch {
    // proventoReceived not available yet
  }

  const firstOpDate = ops[0].date;
  const today = new Date();
  const months = monthsBetween(firstOpDate, today);

  // Determine which tickers have price history
  const tickersWithHistory = new Set(rawPrices.map((p) => p.ticker));
  const tickersWithoutHistory = portfolioTickers.filter((t) => !tickersWithHistory.has(t));
  const hasPriceHistory = tickersWithHistory.size > BENCHMARKS.length;

  // Group ops by ticker for position calculation
  const opsByTicker = new Map<string, typeof ops>();
  for (const op of ops) {
    const list = opsByTicker.get(op.ticker) ?? [];
    list.push(op);
    opsByTicker.set(op.ticker, list);
  }

  // Helper: find latest price for ticker at or before a given month
  function getPriceAtMonth(ticker: string, targetMonth: string): number | null {
    const tickerMap = priceByMonth.get(ticker);
    if (!tickerMap) return null;
    // Walk backwards from targetMonth to find a price
    const entries = Array.from(tickerMap.entries()).sort(([a], [b]) => b.localeCompare(a));
    for (const [mk, close] of entries) {
      if (mk <= targetMonth) return close;
    }
    return null;
  }

  // Benchmark start prices (at portfolio start month)
  const startMonth = months[0];
  const bova11Start = getPriceAtMonth("BOVA11", startMonth);
  const xfix11Start = getPriceAtMonth("XFIX11", startMonth);

  // Cumulative proventos by end of each month
  let proventosAccum = 0;
  let proventoIdx = 0;

  const result: MonthPoint[] = [];

  for (const month of months) {
    const monthEnd = lastDayOfMonth(month);

    // Advance proventos pointer
    while (proventoIdx < rawProventos.length) {
      const p = rawProventos[proventoIdx];
      if (new Date(p.date) <= monthEnd) {
        proventosAccum += p.totalValue;
        proventoIdx++;
      } else {
        break;
      }
    }

    let portfolioValue = 0;
    let portfolioCost = 0;
    let hasPrices = false;

    for (const [ticker, tickerOps] of Array.from(opsByTicker.entries())) {
      // Only ops up to this month
      const opsUntilMonth = tickerOps.filter((o) => new Date(o.date) <= monthEnd);
      if (opsUntilMonth.length === 0) continue;

      const raw = opsUntilMonth as unknown as Record<string, unknown>[];
      const pos = calculatePosition(
        raw.map((o) => ({
          type: o.type as string,
          date: (o.date as Date).toISOString().slice(0, 10),
          quantity: o.quantity as number,
          unitPrice: (o.unitPrice as number | null) ?? null,
          totalValue: (o.totalValue as number | null) ?? null,
          fees: (o.fees as number) ?? 0,
          affectsPosition: (o.affectsPosition as boolean | null) ?? true,
          splitRatio: (o.splitRatio as number | null) ?? null,
        }))
      );

      if (pos.quantity <= 0) continue;

      portfolioCost += pos.totalCost;

      const price = getPriceAtMonth(ticker, month);
      if (price !== null) {
        portfolioValue += pos.quantity * price;
        hasPrices = true;
      } else {
        portfolioValue += pos.totalCost; // fallback: use cost
      }
    }

    const gainLoss = portfolioValue - portfolioCost;
    const returnPct = portfolioCost > 0 ? (gainLoss / portfolioCost) * 100 : 0;
    const totalReturnPct =
      portfolioCost > 0 ? ((gainLoss + proventosAccum) / portfolioCost) * 100 : 0;

    const bova11Price = getPriceAtMonth("BOVA11", month);
    const xfix11Price = getPriceAtMonth("XFIX11", month);

    const bova11Pct =
      bova11Start && bova11Price ? ((bova11Price - bova11Start) / bova11Start) * 100 : null;
    const xfix11Pct =
      xfix11Start && xfix11Price ? ((xfix11Price - xfix11Start) / xfix11Start) * 100 : null;

    result.push({
      month,
      portfolioValue,
      portfolioCost,
      proventosAccum,
      returnPct,
      totalReturnPct,
      bova11Pct,
      xfix11Pct,
      hasPrices,
    });
  }

  return Response.json({
    months: result,
    hasPriceHistory,
    tickersWithoutHistory,
  });
}
