import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json() as {
    name?: string;
    icon?: string;
    color?: string;
    isIncome?: boolean;
  };

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Categoria não encontrada" }, { status: 404 });

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(body.name?.trim() && { name: body.name.trim() }),
      ...(body.icon && { icon: body.icon }),
      ...(body.color && { color: body.color }),
      ...(body.isIncome !== undefined && { isIncome: body.isIncome }),
    },
  });

  return Response.json(category);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { transactions: true, children: true } } },
  });
  if (!existing) return Response.json({ error: "Categoria não encontrada" }, { status: 404 });
  if (existing._count.transactions > 0) {
    return Response.json(
      { error: `Esta categoria possui ${existing._count.transactions} transação(ões). Recategorize-as antes de excluir.` },
      { status: 400 }
    );
  }
  if (existing._count.children > 0) {
    return Response.json({ error: "Exclua as subcategorias primeiro" }, { status: 400 });
  }

  await prisma.categoryRule.deleteMany({ where: { categoryId: id } });
  await prisma.category.delete({ where: { id } });

  return Response.json({ ok: true });
}
