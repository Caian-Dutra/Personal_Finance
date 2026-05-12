import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const item = await prisma.patrimonyItem.findUnique({
    where: { id },
    include: {
      valueHistory: { orderBy: { date: "asc" } },
      linkedExpenses: true,
    },
  });

  if (!item || !item.isActive) {
    return Response.json({ error: "Item não encontrado" }, { status: 404 });
  }

  const txIds = item.linkedExpenses.map((e) => e.transactionId);
  const txAmounts =
    txIds.length > 0
      ? await prisma.transaction.findMany({
          where: { id: { in: txIds } },
          select: { id: true, amount: true },
        })
      : [];
  const txAmountMap = new Map(txAmounts.map((t) => [t.id, t.amount]));

  const sorted = [...item.valueHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const currentValue = sorted.length > 0 ? sorted[0].value : item.purchaseValue;
  const totalExpenses = item.linkedExpenses.reduce(
    (sum, e) => sum + Math.abs(txAmountMap.get(e.transactionId) ?? 0),
    0
  );

  return Response.json({ ...item, currentValue, totalExpenses });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await req.json() as {
    name?: string;
    type?: string;
    subtype?: string;
    purchaseDate?: string;
    purchaseValue?: number;
    acquisitionType?: string;
    fipeBrand?: string;
    fipeModel?: string;
    fipeYear?: number;
    fipeFuel?: string;
    fipeBrandCode?: string;
    fipeModelCode?: string;
    fipeYearCode?: string;
    fipeVehicleType?: string;
    notes?: string;
  };

  const item = await prisma.patrimonyItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.subtype !== undefined && { subtype: body.subtype }),
      ...(body.purchaseDate !== undefined && { purchaseDate: new Date(body.purchaseDate) }),
      ...(body.purchaseValue !== undefined && { purchaseValue: body.purchaseValue }),
      ...(body.acquisitionType !== undefined && { acquisitionType: body.acquisitionType }),
      ...(body.fipeBrand !== undefined && { fipeBrand: body.fipeBrand }),
      ...(body.fipeModel !== undefined && { fipeModel: body.fipeModel }),
      ...(body.fipeYear !== undefined && { fipeYear: body.fipeYear }),
      ...(body.fipeFuel !== undefined && { fipeFuel: body.fipeFuel }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.fipeBrandCode ? { fipeBrandCode: body.fipeBrandCode } : {}),
      ...(body.fipeModelCode ? { fipeModelCode: body.fipeModelCode } : {}),
      ...(body.fipeYearCode ? { fipeYearCode: body.fipeYearCode } : {}),
      ...(body.fipeVehicleType ? { fipeVehicleType: body.fipeVehicleType } : {}),
    },
    include: {
      valueHistory: { orderBy: { date: "asc" } },
      linkedExpenses: true,
    },
  });

  const sorted = [...item.valueHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const currentValue = sorted.length > 0 ? sorted[0].value : item.purchaseValue;

  return Response.json({ ...item, currentValue, totalExpenses: 0 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.patrimonyItem.update({
    where: { id },
    data: { isActive: false },
  });

  return Response.json({ ok: true });
}
