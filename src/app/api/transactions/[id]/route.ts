import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PatchBody {
  description?: string;
  notes?: string;
  tags?: string[];
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json() as Partial<PatchBody>;

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.deletedAt) return Response.json({ error: "Transação não encontrada" }, { status: 404 });

  const edits: { field: string; oldValue: string; newValue: string }[] = [];

  if (body.description !== undefined && body.description !== tx.description) {
    edits.push({ field: "description", oldValue: tx.description, newValue: body.description });
  }
  if (body.notes !== undefined && body.notes !== (tx.notes ?? "")) {
    edits.push({ field: "notes", oldValue: tx.notes ?? "", newValue: body.notes });
  }
  if (body.tags !== undefined) {
    const oldTags = tx.tags;
    const newTags = JSON.stringify(body.tags);
    if (oldTags !== newTags) {
      edits.push({ field: "tags", oldValue: oldTags, newValue: newTags });
    }
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...(body.description !== undefined && { description: body.description }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.tags !== undefined && { tags: JSON.stringify(body.tags) }),
      ...(edits.length > 0 && {
        editHistory: {
          create: edits.map((e) => ({
            field: e.field,
            oldValue: e.oldValue,
            newValue: e.newValue,
          })),
        },
      }),
    },
    include: {
      account: { select: { id: true, name: true, bank: true, color: true } },
      category: { select: { id: true, name: true, color: true, icon: true, parentId: true } },
    },
  });

  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.deletedAt) return Response.json({ error: "Transação não encontrada" }, { status: 404 });

  await prisma.transaction.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return Response.json({ ok: true });
}
