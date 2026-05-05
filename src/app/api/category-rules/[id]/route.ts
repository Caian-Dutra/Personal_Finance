import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json() as {
    categoryId?: string;
    pattern?: string;
    matchType?: string;
    priority?: number;
    applyToFuture?: boolean;
    applyToAll?: boolean;
  };

  const existing = await prisma.categoryRule.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Regra não encontrada" }, { status: 404 });

  const matchType = body.matchType ?? existing.matchType;
  const pattern = body.pattern?.trim() ?? existing.pattern;

  if (!["exact", "contains", "regex"].includes(matchType)) {
    return Response.json({ error: "matchType inválido" }, { status: 400 });
  }
  if (matchType === "regex") {
    try { new RegExp(pattern); } catch {
      return Response.json({ error: "Expressão regular inválida" }, { status: 400 });
    }
  }
  if (body.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!cat) return Response.json({ error: "Categoria não encontrada" }, { status: 404 });
  }

  const patternChanged = body.pattern !== undefined && body.pattern.trim() !== existing.pattern;

  const rule = await prisma.categoryRule.update({
    where: { id },
    data: {
      ...(body.categoryId && { categoryId: body.categoryId }),
      pattern,
      matchType,
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.applyToFuture !== undefined && { applyToFuture: body.applyToFuture }),
      ...(body.applyToAll !== undefined && { applyToAll: body.applyToAll }),
      ...(patternChanged && { hitCount: 0 }),
    },
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
  });

  return Response.json(rule);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const existing = await prisma.categoryRule.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Regra não encontrada" }, { status: 404 });

  await prisma.categoryRule.delete({ where: { id } });

  return Response.json({ ok: true });
}
