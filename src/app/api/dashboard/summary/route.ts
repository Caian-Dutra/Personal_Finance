import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function periodAggs(from: Date, to: Date) {
  const txs = await prisma.transaction.findMany({
    where: { deletedAt: null, isInternalTransfer: false, date: { gte: from, lte: to } },
    select: { amount: true },
  });
  let income = 0, expenses = 0;
  for (const t of txs) {
    if (t.amount > 0) income   += t.amount;
    else              expenses += t.amount;
  }
  return { income, expenses };
}

async function totalBalance() {
  const accounts = await prisma.account.findMany({ select: { id: true, initialBalance: true } });
  let total = 0;
  for (const acc of accounts) {
    const latest = await prisma.dailyBalance.findFirst({
      where: { accountId: acc.id },
      orderBy: { date: "desc" },
    });
    total += latest?.balance ?? acc.initialBalance;
  }
  return total;
}

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  // Default: mês corrente
  const now  = new Date();
  const from = fromParam ? new Date(fromParam + "T00:00:00Z") : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to   = toParam   ? new Date(toParam   + "T23:59:59Z") : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

  // Período anterior de mesma duração
  const durationMs = to.getTime() - from.getTime();
  const prevTo   = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  const [cur, prev, balance] = await Promise.all([
    periodAggs(from, to),
    periodAggs(prevFrom, prevTo),
    totalBalance(),
  ]);

  return Response.json({
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    income:       Math.round(cur.income   * 100) / 100,
    expenses:     Math.round(cur.expenses * 100) / 100,
    net:          Math.round((cur.income + cur.expenses) * 100) / 100,
    totalBalance: Math.round(balance * 100) / 100,
    prev: {
      income:   Math.round(prev.income   * 100) / 100,
      expenses: Math.round(prev.expenses * 100) / 100,
      net:      Math.round((prev.income + prev.expenses) * 100) / 100,
    },
  });
}
