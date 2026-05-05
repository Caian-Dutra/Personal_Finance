import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await prisma.categoryRule.findMany({
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return Response.json(rules);
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    categoryId?: string;
    pattern?: string;
    matchType?: string;
    priority?: number;
    applyToFuture?: boolean;
    applyToAll?: boolean;
  };

  if (!body.categoryId) return Response.json({ error: "categoryId é obrigatório" }, { status: 400 });
  if (!body.pattern?.trim()) return Response.json({ error: "pattern é obrigatório" }, { status: 400 });
  if (!["exact", "contains", "regex"].includes(body.matchType ?? "")) {
    return Response.json({ error: "matchType inválido" }, { status: 400 });
  }
  if (body.matchType === "regex") {
    try { new RegExp(body.pattern); } catch {
      return Response.json({ error: "Expressão regular inválida" }, { status: 400 });
    }
  }

  const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
  if (!category) return Response.json({ error: "Categoria não encontrada" }, { status: 404 });

  const rule = await prisma.categoryRule.create({
    data: {
      categoryId: body.categoryId,
      pattern: body.pattern.trim(),
      matchType: body.matchType!,
      priority: body.priority ?? 0,
      applyToFuture: body.applyToFuture ?? true,
      applyToAll: body.applyToAll ?? false,
    },
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
  });

  return Response.json(rule, { status: 201 });
}
