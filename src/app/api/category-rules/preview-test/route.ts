import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { pattern?: string; matchType?: string };

  if (!body.pattern?.trim()) return Response.json({ error: "pattern é obrigatório" }, { status: 400 });
  if (!["exact", "contains", "regex"].includes(body.matchType ?? "")) {
    return Response.json({ error: "matchType inválido" }, { status: 400 });
  }
  if (body.matchType === "regex") {
    try { new RegExp(body.pattern); } catch {
      return Response.json({ error: "Expressão regular inválida" }, { status: 400 });
    }
  }

  const allTx = await prisma.transaction.findMany({
    where: { deletedAt: null },
    select: { id: true, description: true, normalizedName: true, amount: true, date: true },
    orderBy: { date: "desc" },
  });

  const matched = allTx.filter((tx) => {
    try {
      if (body.matchType === "exact") return tx.normalizedName === body.pattern;
      if (body.matchType === "contains") return tx.normalizedName.includes(body.pattern!);
      if (body.matchType === "regex") return new RegExp(body.pattern!).test(tx.normalizedName);
    } catch { /* noop */ }
    return false;
  });

  return Response.json({ count: matched.length, samples: matched.slice(0, 10) });
}
