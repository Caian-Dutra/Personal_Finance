import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  const now  = new Date();
  const to   = toParam   ? new Date(toParam   + "T23:59:59Z") : now;
  const from = fromParam ? new Date(fromParam + "T00:00:00Z") : new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));

  // Gerar lista de meses entre from e to
  const months: { label: string; from: Date; to: Date }[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));

  while (cursor <= to) {
    const y  = cursor.getUTCFullYear();
    const m  = cursor.getUTCMonth();
    const mFrom = new Date(Date.UTC(y, m, 1));
    const mTo   = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));

    months.push({
      label: mFrom.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }),
      from:  mFrom,
      to:    new Date(Math.min(mTo.getTime(), to.getTime())),
    });

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const results = await Promise.all(
    months.map(async ({ label, from: mFrom, to: mTo }) => {
      const txs = await prisma.transaction.findMany({
        where: { deletedAt: null, isInternalTransfer: false, date: { gte: mFrom, lte: mTo } },
        select: { amount: true },
      });
      let income = 0, expenses = 0;
      for (const t of txs) {
        if (t.amount > 0) income   += t.amount;
        else              expenses += Math.abs(t.amount);
      }
      return {
        label,
        income:   Math.round(income   * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
      };
    })
  );

  return Response.json(results);
}
