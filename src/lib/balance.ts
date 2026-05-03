import { prisma } from "@/lib/prisma";

export async function recalculateDailyBalances(accountId: string, fromDate: Date) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

  const before = await prisma.dailyBalance.findFirst({
    where: { accountId, date: { lt: fromDate } },
    orderBy: { date: "desc" },
  });

  let runningBalance = before?.balance ?? account.initialBalance;

  const txs = await prisma.transaction.findMany({
    where: { accountId, date: { gte: fromDate } },
    orderBy: { date: "asc" },
  });

  const dailyMap = new Map<string, number>();
  for (const tx of txs) {
    runningBalance += tx.amount;
    const dayKey = tx.date.toISOString().slice(0, 10);
    dailyMap.set(dayKey, runningBalance);
  }

  await Promise.all(
    Array.from(dailyMap.entries()).map(([day, balance]) =>
      prisma.dailyBalance.upsert({
        where: { accountId_date: { accountId, date: new Date(day) } },
        update: { balance },
        create: { accountId, date: new Date(day), balance },
      })
    )
  );
}
