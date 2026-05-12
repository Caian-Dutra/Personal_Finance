import { validateSession } from "@/lib/auth";
import { unlinkTransferPair } from "@/lib/internalTransferDetector";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!tx || tx.deletedAt) return Response.json({ error: "Transação não encontrada" }, { status: 404 });

  await unlinkTransferPair(params.id);

  return Response.json({ ok: true });
}
