import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const expenses = await prisma.patrimonyExpense.findMany({
    where: { itemId: id },
    orderBy: { createdAt: "desc" },
  });

  if (expenses.length === 0) return Response.json([]);

  const txIds = expenses.map((e) => e.transactionId);
  const transactions = await prisma.transaction.findMany({
    where: { id: { in: txIds } },
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
  });
  const txMap = new Map(transactions.map((t) => [t.id, t]));

  const result = expenses.map((e) => ({
    ...e,
    transaction: txMap.get(e.transactionId) ?? null,
  }));

  return Response.json(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await req.json() as { transactionId?: string };

  if (!body.transactionId) {
    return Response.json({ error: "transactionId é obrigatório" }, { status: 400 });
  }

  const existing = await prisma.patrimonyExpense.findFirst({
    where: { itemId: id, transactionId: body.transactionId },
  });
  if (existing) {
    return Response.json({ error: "Transação já vinculada a este bem" }, { status: 409 });
  }

  const expense = await prisma.patrimonyExpense.create({
    data: { itemId: id, transactionId: body.transactionId },
  });

  const transaction = await prisma.transaction.findUnique({
    where: { id: body.transactionId },
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
  });

  return Response.json({ ...expense, transaction }, { status: 201 });
}
