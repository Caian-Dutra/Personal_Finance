import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PROFILE = "default_profile";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({
    where: { profileId: DEFAULT_PROFILE, isActive: true },
    include: {
      dailyBalances: { orderBy: { date: "desc" }, take: 1 },
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = accounts.map(({ dailyBalances, ...acc }) => ({
    ...acc,
    currentBalance: dailyBalances[0]?.balance ?? acc.initialBalance,
  }));

  return Response.json(result);
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    bank?: string;
    name?: string;
    type?: string;
    currency?: string;
    initialBalance?: number;
    initialDate?: string;
    color?: string;
  };

  if (!body.bank || !body.name || !body.type) {
    return Response.json({ error: "bank, name e type são obrigatórios" }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      profileId: DEFAULT_PROFILE,
      bank: body.bank,
      name: body.name,
      type: body.type,
      currency: body.currency ?? "BRL",
      initialBalance: body.initialBalance ?? 0,
      initialDate: body.initialDate ? new Date(body.initialDate) : null,
      color: body.color ?? "#1ABC9C",
    },
  });

  return Response.json(account, { status: 201 });
}
