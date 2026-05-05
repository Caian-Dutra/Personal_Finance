import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { learnFromEdit } from "@/lib/categorizer";

interface CategorizeBody {
  categoryId: string;
  scope: "this" | "future" | "all";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json() as Partial<CategorizeBody>;

  if (!body.categoryId) {
    return Response.json({ error: "categoryId é obrigatório" }, { status: 400 });
  }
  if (!["this", "future", "all"].includes(body.scope ?? "")) {
    return Response.json({ error: "scope deve ser 'this', 'future' ou 'all'" }, { status: 400 });
  }

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.deletedAt) return Response.json({ error: "Transação não encontrada" }, { status: 404 });

  const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
  if (!category) return Response.json({ error: "Categoria não encontrada" }, { status: 404 });

  const oldCategoryId = tx.categoryId ?? "";

  await prisma.transaction.update({
    where: { id },
    data: {
      categoryId: body.categoryId,
      categorySource: "manual",
      categoryConfidence: 1.0,
      editHistory: {
        create: {
          field: "categoryId",
          oldValue: oldCategoryId,
          newValue: body.categoryId,
        },
      },
    },
  });

  if (body.scope !== "this") {
    await learnFromEdit(id, body.categoryId, body.scope!);
  }

  return Response.json({ ok: true });
}
