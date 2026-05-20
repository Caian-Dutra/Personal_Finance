import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPriceHistory } from "@/lib/external/brapi";

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { ticker: string };
  if (!body.ticker) return Response.json({ error: "ticker é obrigatório" }, { status: 400 });

  const ticker = body.ticker.toUpperCase();

  // Find the most recent date we already have
  const latest = await prisma.priceHistory.findFirst({
    where: { ticker },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  const prices = await getPriceHistory(ticker);

  const cutoff = latest?.date.toISOString().slice(0, 10) ?? "1900-01-01";
  const newPrices = prices.filter((p) => p.date > cutoff);

  for (const p of newPrices) {
    await prisma.priceHistory.upsert({
      where: { ticker_date: { ticker, date: new Date(p.date) } },
      create: { ticker, date: new Date(p.date), close: p.close, source: "brapi" },
      update: { close: p.close },
    });
  }

  return Response.json({ ticker, fetched: newPrices.length, total: prices.length });
}
