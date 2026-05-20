import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculatePortfolio } from "@/lib/investments/position";

const DEFAULT_PROFILE = "default_profile";

function needsRestart(e: unknown): boolean {
  return e instanceof TypeError && e.message.includes("Cannot read properties of undefined");
}

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const assetClass = searchParams.get("assetClass") ?? "all";

  const ops = await prisma.investmentOperation.findMany({
    where: {
      profileId: DEFAULT_PROFILE,
      ...(assetClass !== "all" ? { assetClass } : {}),
    },
    orderBy: { date: "asc" },
  });

  if (ops.length === 0) return Response.json([]);

  // Proventos por ticker (new model — safe to try)
  const proventosByTicker = new Map<string, number>();
  try {
    const proventos = await prisma.proventoReceived.findMany({
      where: { profileId: DEFAULT_PROFILE },
      select: { ticker: true, totalValue: true },
    });
    for (const p of proventos) {
      proventosByTicker.set(p.ticker, (proventosByTicker.get(p.ticker) ?? 0) + p.totalValue);
    }
  } catch (e) {
    if (!needsRestart(e)) throw e;
    // model not available yet — no proventos shown
  }

  // QuoteCache (new model)
  const quoteByTicker = new Map<string, number>();
  try {
    const tickers = Array.from(new Set(ops.map((o) => o.ticker)));
    const quotes = await prisma.quoteCache.findMany({
      where: { ticker: { in: tickers } },
    });
    for (const q of quotes) quoteByTicker.set(q.ticker, q.price);
  } catch (e) {
    if (!needsRestart(e)) throw e;
    // model not available yet — no prices shown
  }

  // Read new fields defensively (old Prisma client returns undefined for unknown fields)
  const portfolio = calculatePortfolio(
    ops.map((o) => {
      const raw = o as unknown as Record<string, unknown>;
      return {
        ticker: o.ticker,
        assetClass: o.assetClass,
        broker: o.broker,
        companyName: (raw.companyName as string | null | undefined) ?? null,
        type: o.type,
        date: o.date.toISOString().slice(0, 10),
        quantity: o.quantity,
        unitPrice: (raw.unitPrice as number | null | undefined) ?? null,
        totalValue: (raw.totalValue as number | null | undefined) ?? null,
        fees: o.fees,
        affectsPosition: (raw.affectsPosition as boolean | null | undefined) ?? true,
        splitRatio: (raw.splitRatio as number | null | undefined) ?? null,
      };
    }),
    proventosByTicker,
    quoteByTicker
  );

  return Response.json(portfolio);
}
