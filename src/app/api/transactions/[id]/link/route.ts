import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkTransferPair } from "@/lib/internalTransferDetector";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json() as { linkedTransactionId?: string };

  if (!body.linkedTransactionId) {
    return Response.json({ error: "linkedTransactionId é obrigatório" }, { status: 400 });
  }
  if (body.linkedTransactionId === id) {
    return Response.json({ error: "Uma transação não pode ser vinculada a si mesma" }, { status: 400 });
  }

  const [txA, txB] = await Promise.all([
    prisma.transaction.findUnique({ where: { id } }),
    prisma.transaction.findUnique({ where: { id: body.linkedTransactionId } }),
  ]);

  if (!txA || txA.deletedAt) return Response.json({ error: "Transação não encontrada" }, { status: 404 });
  if (!txB || txB.deletedAt) return Response.json({ error: "Transação vinculada não encontrada" }, { status: 404 });
  if (txA.accountId === txB.accountId) {
    return Response.json({ error: "As duas transações devem ser de contas diferentes" }, { status: 400 });
  }

  // Determina qual é saída e qual é entrada
  const outId = txA.amount < 0 ? txA.id : txB.id;
  const inId  = txA.amount < 0 ? txB.id : txA.id;

  await linkTransferPair(outId, inId);

  return Response.json({ ok: true });
}
