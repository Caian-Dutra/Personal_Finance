import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const batches = await prisma.importBatch.findMany({
    orderBy: { importedAt: "desc" },
    take: 50,
  });

  return Response.json(batches);
}

export async function DELETE(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id é obrigatório" }, { status: 400 });

  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) return Response.json({ error: "Lote não encontrado" }, { status: 404 });

  // Soft delete: mark transactions as without batch, then delete batch
  await prisma.transaction.updateMany({
    where: { importBatchId: id },
    data: { importBatchId: null },
  });
  await prisma.importBatch.delete({ where: { id } });

  return Response.json({ ok: true });
}
