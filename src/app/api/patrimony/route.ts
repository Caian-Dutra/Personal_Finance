import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PROFILE = "default_profile";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.patrimonyItem.findMany({
    where: { profileId: DEFAULT_PROFILE, isActive: true },
    include: {
      valueHistory: { orderBy: { date: "asc" } },
      linkedExpenses: true,
    },
    orderBy: { purchaseDate: "desc" },
  });

  const txIds = items.flatMap((i) => i.linkedExpenses.map((e) => e.transactionId));
  const txAmounts =
    txIds.length > 0
      ? await prisma.transaction.findMany({
          where: { id: { in: txIds } },
          select: { id: true, amount: true },
        })
      : [];
  const txAmountMap = new Map(txAmounts.map((t) => [t.id, t.amount]));

  const result = items.map((item) => {
    const sorted = [...item.valueHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const currentValue = sorted.length > 0 ? sorted[0].value : item.purchaseValue;
    const totalExpenses = item.linkedExpenses.reduce(
      (sum, e) => sum + Math.abs(txAmountMap.get(e.transactionId) ?? 0),
      0
    );
    return { ...item, currentValue, totalExpenses };
  });

  return Response.json(result);
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!body.name || !body.type || !body.purchaseDate || body.purchaseValue === undefined || !body.acquisitionType) {
    return Response.json(
      { error: "name, type, purchaseDate, purchaseValue e acquisitionType são obrigatórios" },
      { status: 400 }
    );
  }

  const item = await prisma.patrimonyItem.create({
    data: {
      profileId: DEFAULT_PROFILE,
      name: body.name,
      type: body.type,
      subtype: body.subtype ?? null,
      purchaseDate: new Date(body.purchaseDate),
      purchaseValue: body.purchaseValue,
      acquisitionType: body.acquisitionType,
      fipeBrand: body.fipeBrand ?? null,
      fipeModel: body.fipeModel ?? null,
      fipeYear: body.fipeYear ?? null,
      fipeFuel: body.fipeFuel ?? null,
      notes: body.notes ?? null,
      ...(body.fipeBrandCode ? { fipeBrandCode: body.fipeBrandCode } : {}),
      ...(body.fipeModelCode ? { fipeModelCode: body.fipeModelCode } : {}),
      ...(body.fipeYearCode ? { fipeYearCode: body.fipeYearCode } : {}),
      ...(body.fipeVehicleType ? { fipeVehicleType: body.fipeVehicleType } : {}),
    },
  });

  await prisma.patrimonyValue.create({
    data: {
      itemId: item.id,
      date: item.purchaseDate,
      value: item.purchaseValue,
      source: "manual",
    },
  });

  const full = await prisma.patrimonyItem.findUnique({
    where: { id: item.id },
    include: {
      valueHistory: { orderBy: { date: "asc" } },
      linkedExpenses: true,
    },
  });

  return Response.json({ ...full, currentValue: item.purchaseValue, totalExpenses: 0 }, { status: 201 });
}
