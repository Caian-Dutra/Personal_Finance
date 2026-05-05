import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rule = await prisma.categoryRule.findUnique({ where: { id: params.id } });
  if (!rule) return Response.json({ error: "Regra não encontrada" }, { status: 404 });

  const allTx = await prisma.transaction.findMany({
    where: { deletedAt: null },
    select: { id: true, description: true, normalizedName: true, amount: true, date: true, categoryId: true },
    orderBy: { date: "desc" },
  });

  const matched = allTx.filter((tx) => {
    try {
      if (rule.matchType === "exact") return tx.normalizedName === rule.pattern;
      if (rule.matchType === "contains") return tx.normalizedName.includes(rule.pattern);
      if (rule.matchType === "regex") return new RegExp(rule.pattern).test(tx.normalizedName);
    } catch { /* invalid regex */ }
    return false;
  });

  return Response.json({
    count: matched.length,
    samples: matched.slice(0, 10),
  });
}
