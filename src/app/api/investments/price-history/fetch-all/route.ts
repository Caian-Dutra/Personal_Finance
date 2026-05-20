import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPriceHistory } from "@/lib/external/brapi";

const DEFAULT_PROFILE = "default_profile";
const BENCHMARKS = ["BOVA11", "XFIX11"];

function needsRestart(e: unknown): boolean {
  return e instanceof TypeError && e.message.includes("Cannot read properties of undefined");
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Test if priceHistory model is available
  try {
    await prisma.priceHistory.count();
  } catch (e) {
    if (needsRestart(e)) {
      return Response.json(
        { error: "PriceHistory indisponível — pare o servidor, execute npx prisma generate e reinicie." },
        { status: 503 }
      );
    }
  }

  const ops = await prisma.investmentOperation.findMany({
    where: { profileId: DEFAULT_PROFILE },
    select: { ticker: true },
    distinct: ["ticker"],
  });

  const portfolioTickers = ops.map((o) => o.ticker);
  const allTickers = Array.from(new Set([...portfolioTickers, ...BENCHMARKS]));

  const results: { ticker: string; saved: number; skipped?: number; error?: string }[] = [];

  for (const ticker of allTickers) {
    try {
      // Get the most recent date we already have for incremental fetch
      const latest = await prisma.priceHistory.findFirst({
        where: { ticker },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      const latestDate = latest?.date
        ? new Date(latest.date).toISOString().slice(0, 10)
        : "1900-01-01";

      const prices = await getPriceHistory(ticker);
      const newPrices = prices.filter((p) => p.date > latestDate);

      let saved = 0;
      for (const p of newPrices) {
        try {
          await prisma.priceHistory.upsert({
            where: { ticker_date: { ticker, date: new Date(p.date) } },
            create: { ticker, date: new Date(p.date), close: p.close, source: "brapi" },
            update: { close: p.close },
          });
          saved++;
        } catch {
          // skip individual duplicate errors
        }
      }

      results.push({ ticker, saved, skipped: newPrices.length - saved });
    } catch (e) {
      results.push({ ticker, saved: 0, error: (e as Error).message });
    }

    // Respect Brapi rate limit (~3–4 req/s on free tier)
    await sleep(350);
  }

  const totalSaved = results.reduce((s, r) => s + r.saved, 0);
  return Response.json({ results, totalSaved, tickers: allTickers.length });
}
