import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    bank?: string;
    name?: string;
    type?: string;
    currency?: string;
    initialBalance?: number;
    initialDate?: string | null;
    color?: string;
    isActive?: boolean;
  };

  const account = await prisma.account.findUnique({ where: { id: params.id } });
  if (!account) return Response.json({ error: "Conta não encontrada" }, { status: 404 });

  const updated = await prisma.account.update({
    where: { id: params.id },
    data: {
      ...(body.bank !== undefined && { bank: body.bank }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.initialBalance !== undefined && { initialBalance: body.initialBalance }),
      ...(body.initialDate !== undefined && {
        initialDate: body.initialDate ? new Date(body.initialDate) : null,
      }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findUnique({
    where: { id: params.id },
    include: { _count: { select: { transactions: true } } },
  });

  if (!account) return Response.json({ error: "Conta não encontrada" }, { status: 404 });

  if (account._count.transactions > 0) {
    return Response.json(
      {
        error: `Não é possível excluir: conta possui ${account._count.transactions} transação(ões) vinculada(s).`,
        code: "HAS_TRANSACTIONS",
      },
      { status: 409 }
    );
  }

  await prisma.account.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
