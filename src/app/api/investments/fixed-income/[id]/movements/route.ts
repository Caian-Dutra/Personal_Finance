import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// IOF table: days[0] = day 1 (96%), ..., days[28] = day 29 (3%), days[29+] = 0%
const IOF_TABLE = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3];

function calcIof(grossYield: number, daysSinceApply: number): number {
  if (daysSinceApply >= 30) return 0;
  const rate = (IOF_TABLE[daysSinceApply - 1] ?? 0) / 100;
  return grossYield * rate;
}

function calcIr(grossYield: number, daysSinceApply: number): number {
  let rate = 0.225;
  if (daysSinceApply > 720) rate = 0.15;
  else if (daysSinceApply > 360) rate = 0.175;
  else if (daysSinceApply > 180) rate = 0.20;
  return grossYield * rate;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const movements = await prisma.fixedIncomeMovement.findMany({
    where: { assetId: id },
    orderBy: { date: "asc" },
  });

  return Response.json(movements);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await req.json() as {
    date?: string;
    type?: string;
    amount?: number;
    balanceAfter?: number;
    description?: string;
    linkedTransactionId?: string;
  };

  if (!body.date || !body.type || body.amount === undefined) {
    return Response.json({ error: "date, type e amount são obrigatórios" }, { status: 400 });
  }

  const asset = await prisma.fixedIncomeAsset.findUnique({ where: { id } });
  if (!asset) return Response.json({ error: "Ativo não encontrado" }, { status: 404 });

  const movement = await prisma.fixedIncomeMovement.create({
    data: {
      assetId: id,
      date: new Date(body.date),
      type: body.type,
      amount: body.amount,
      balanceAfter: body.balanceAfter ?? null,
      description: body.description ?? null,
      linkedTransactionId: body.linkedTransactionId ?? null,
    },
  });

  // Update asset currentValue and investedValue
  if (body.type === "apply") {
    await prisma.fixedIncomeAsset.update({
      where: { id },
      data: {
        investedValue: asset.investedValue + body.amount,
        currentValue: body.balanceAfter ?? asset.currentValue + body.amount,
      },
    });
  } else if (body.type === "redeem") {
    await prisma.fixedIncomeAsset.update({
      where: { id },
      data: {
        investedValue: Math.max(0, asset.investedValue + body.amount), // amount is negative
        currentValue: body.balanceAfter ?? Math.max(0, asset.currentValue + body.amount),
      },
    });
  } else if (body.type === "update" && body.balanceAfter !== undefined) {
    await prisma.fixedIncomeAsset.update({
      where: { id },
      data: { currentValue: body.balanceAfter },
    });
  }

  // Calculate estimated IOF and IR for redeem operations
  let estimatedTaxes = null;
  if (body.type === "redeem") {
    const firstApply = await prisma.fixedIncomeMovement.findFirst({
      where: { assetId: id, type: "apply" },
      orderBy: { date: "asc" },
    });
    if (firstApply) {
      const days = Math.floor(
        (new Date(body.date).getTime() - firstApply.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      const grossRedeemed = Math.abs(body.amount);
      const principalPercentage = asset.investedValue > 0
        ? Math.min(grossRedeemed / asset.currentValue, 1)
        : 1;
      const grossYield = grossRedeemed * (1 - principalPercentage);
      const iof = calcIof(grossYield, days);
      const ir = calcIr(grossYield - iof, days);
      estimatedTaxes = { days, iof: Math.round(iof * 100) / 100, ir: Math.round(ir * 100) / 100 };
    }
  }

  return Response.json({ movement, estimatedTaxes }, { status: 201 });
}
