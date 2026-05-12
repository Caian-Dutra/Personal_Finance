import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  const now  = new Date();
  const from = fromParam ? new Date(fromParam + "T00:00:00Z") : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to   = toParam   ? new Date(toParam   + "T23:59:59Z") : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

  const txs = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      isInternalTransfer: false,
      amount: { lt: 0 },
      date: { gte: from, lte: to },
    },
    include: {
      category: {
        select: {
          id: true, name: true, color: true,
          parent: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  const map = new Map<string, { name: string; color: string; total: number }>();

  for (const tx of txs) {
    const cat  = tx.category;
    const root = cat?.parent ?? cat;
    const key  = root?.id ?? "__none__";
    const name  = root?.name  ?? "Sem categoria";
    const color = root?.color ?? "#95A5A6";

    const existing = map.get(key);
    if (existing) existing.total += Math.abs(tx.amount);
    else map.set(key, { name, color, total: Math.abs(tx.amount) });
  }

  const result = Array.from(map.entries())
    .map(([id, v]) => ({ id, name: v.name, color: v.color, total: Math.round(v.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return Response.json(result);
}
