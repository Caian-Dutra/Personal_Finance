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
  const from = fromParam ? new Date(fromParam + "T00:00:00Z") : new Date(now.getTime() - 30 * 86_400_000);
  from.setUTCHours(0, 0, 0, 0);

  const totalDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);

  // Para ranges muito longos (>180 dias), agregamos por semana
  const useWeekly = totalDays > 180;

  const accounts = await prisma.account.findMany({
    select: { id: true, initialBalance: true },
  });

  // Baseline: último saldo antes do início do período
  const baselines = await Promise.all(
    accounts.map(async (acc) => {
      const last = await prisma.dailyBalance.findFirst({
        where: { accountId: acc.id, date: { lt: from } },
        orderBy: { date: "desc" },
      });
      return { accountId: acc.id, balance: last?.balance ?? acc.initialBalance };
    })
  );
  const currentBalance = new Map(baselines.map((b) => [b.accountId, b.balance]));

  // Busca DailyBalances no período
  const dbEntries = await prisma.dailyBalance.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });

  const byDate = new Map<string, Map<string, number>>();
  for (const e of dbEntries) {
    const key = e.date.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, new Map());
    byDate.get(key)!.set(e.accountId, e.balance);
  }

  // Gera série diária
  const daily: { date: string; total: number }[] = [];
  const cur = new Map(currentBalance);
  let cursor = new Date(from);

  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    const dayEntries = byDate.get(key);
    if (dayEntries) dayEntries.forEach((bal, accId) => cur.set(accId, bal));

    const total = Array.from(cur.values()).reduce((s, v) => s + v, 0);
    daily.push({ date: key, total: Math.round(total * 100) / 100 });
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  if (!useWeekly) return Response.json(daily);

  // Agrega por semana (último dia de cada semana)
  const weekly: { date: string; total: number }[] = [];
  for (let i = 6; i < daily.length; i += 7) {
    weekly.push(daily[i]);
  }
  // Garante que o último ponto sempre aparece
  if (daily.length > 0 && (daily.length - 1) % 7 !== 6) {
    weekly.push(daily[daily.length - 1]);
  }

  return Response.json(weekly);
}
