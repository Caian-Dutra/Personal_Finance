import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface BulkBody {
  ids: string[];
  categoryId: string;
}

export async function PATCH(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<BulkBody>;

  if (!body.ids?.length) return Response.json({ error: "ids é obrigatório" }, { status: 400 });
  if (!body.categoryId) return Response.json({ error: "categoryId é obrigatório" }, { status: 400 });

  const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
  if (!category) return Response.json({ error: "Categoria não encontrada" }, { status: 404 });

  const { count } = await prisma.transaction.updateMany({
    where: { id: { in: body.ids }, deletedAt: null },
    data: {
      categoryId: body.categoryId,
      categorySource: "manual",
      categoryConfidence: 1.0,
    },
  });

  return Response.json({ updated: count });
}
