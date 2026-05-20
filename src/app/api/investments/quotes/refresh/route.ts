import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getQuotes } from "@/lib/external/brapi";

const DEFAULT_PROFILE = "default_profile";

function needsRestart(e: unknown): boolean {
  return e instanceof TypeError && e.message.includes("Cannot read properties of undefined");
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Collect all unique tickers in portfolio
  const ops = await prisma.investmentOperation.findMany({
    where: { profileId: DEFAULT_PROFILE },
    select: { ticker: true },
    distinct: ["ticker"],
  });

  const tickers = ops.map((o) => o.ticker);
  if (tickers.length === 0) return Response.json([]);

  // Fetch quotes in batches of 50 (Brapi limit)
  const BATCH = 50;
  const allQuotes: { ticker: string; price: number; change1d: number; name: string }[] = [];
  const errors: string[] = [];

  for (let i = 0; i < tickers.length; i += BATCH) {
    try {
      const batch = await getQuotes(tickers.slice(i, i + BATCH));
      allQuotes.push(...batch);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (allQuotes.length === 0 && errors.length > 0) {
    return Response.json(
      { error: `Brapi retornou erro: ${errors[0]}`, errors },
      { status: 502 }
    );
  }

  // Save to QuoteCache
  const saved: string[] = [];
  for (const q of allQuotes) {
    try {
      await prisma.quoteCache.upsert({
        where: { ticker: q.ticker },
        create: { ticker: q.ticker, price: q.price, change1d: q.change1d },
        update: { price: q.price, change1d: q.change1d },
      });
      saved.push(q.ticker);
    } catch (e) {
      if (needsRestart(e)) {
        return Response.json(
          { error: "QuoteCache indisponível — pare o servidor, execute npx prisma generate e reinicie." },
          { status: 503 }
        );
      }
      errors.push(`${q.ticker}: ${(e as Error).message}`);
    }
  }

  return Response.json({ saved, count: saved.length, errors: errors.length > 0 ? errors : undefined });
}
