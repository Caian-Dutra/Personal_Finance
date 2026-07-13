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

/** Returns the smallest Brapi range that covers the gap from latestDate to today. */
function rangeForGap(latestDate: string | null): string | null {
  if (!latestDate) return "2y"; // first fetch

  const diffDays = Math.ceil(
    (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) return null; // already up to date
  if (diffDays <= 7) return "1mo";
  if (diffDays <= 30) return "3mo";
  if (diffDays <= 90) return "6mo";
  if (diffDays <= 180) return "1y";
  return "2y";
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Fail fast if model not yet in Prisma client
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream already closed — ignore
        }
      };

      let totalSaved = 0;

      for (let i = 0; i < allTickers.length; i++) {
        const ticker = allTickers[i];

        send({ type: "progress", current: i + 1, total: allTickers.length, ticker });

        try {
          const latest = await prisma.priceHistory.findFirst({
            where: { ticker },
            orderBy: { date: "desc" },
            select: { date: true },
          });

          const latestDate = latest?.date
            ? new Date(latest.date).toISOString().slice(0, 10)
            : null;

          // Skip if already have today's data
          const today = new Date().toISOString().slice(0, 10);
          if (latestDate === today) {
            send({ type: "ticker_done", ticker, saved: 0, reason: "up_to_date" });
            continue; // no external request made, skip delay
          }

          const range = rangeForGap(latestDate);
          if (!range) {
            send({ type: "ticker_done", ticker, saved: 0, reason: "up_to_date" });
            continue;
          }

          const prices = await getPriceHistory(ticker, range);

          // Only rows newer than what we already have
          const newPrices = latestDate
            ? prices.filter((p) => p.date > latestDate)
            : prices;

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
              // skip individual conflict errors
            }
          }

          totalSaved += saved;
          send({ type: "ticker_done", ticker, saved });
        } catch (e) {
          const msg = (e as Error).message ?? "";

          if (msg.includes("402")) {
            send({
              type: "rate_limit",
              message: "Limite mensal da API atingido. O histórico será atualizado no próximo mês.",
            });
            break;
          }

          send({ type: "ticker_error", ticker, error: msg });
        }

        // 500ms between external requests to stay within free-tier rate limit
        if (i < allTickers.length - 1) {
          await sleep(500);
        }
      }

      send({ type: "done", totalSaved, tickers: allTickers.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
