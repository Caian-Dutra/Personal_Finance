import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.category.findMany({
    where: { parentId: null },
    include: {
      children: {
        include: { _count: { select: { transactions: true, rules: true } } },
        orderBy: { name: "asc" },
      },
      _count: { select: { transactions: true, rules: true } },
    },
    orderBy: { name: "asc" },
  });

  return Response.json(categories);
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    parentId?: string | null;
    icon?: string;
    color?: string;
    isIncome?: boolean;
  };

  if (!body.name?.trim()) return Response.json({ error: "Nome é obrigatório" }, { status: 400 });

  if (body.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
    if (!parent) return Response.json({ error: "Categoria pai não encontrada" }, { status: 404 });
    if (parent.parentId) return Response.json({ error: "Não é possível criar sub-sub-categorias" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: {
      name: body.name.trim(),
      parentId: body.parentId ?? null,
      icon: body.icon ?? "circle",
      color: body.color ?? "#95A5A6",
      isIncome: body.isIncome ?? false,
      isSystem: false,
    },
  });

  return Response.json(category, { status: 201 });
}
