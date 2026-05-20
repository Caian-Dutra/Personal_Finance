import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PROFILE = "default_profile";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const assets = await db.fixedIncomeAsset.findMany({
      where: { profileId: DEFAULT_PROFILE, isActive: true },
      include: { movements: { orderBy: { date: "desc" }, take: 1 } },
      orderBy: { purchaseDate: "desc" },
    });

    return Response.json(
      assets.map((a: { movements: { balanceAfter?: number | null }[]; currentValue: number; [key: string]: unknown }) => ({
        ...a,
        latestBalance: a.movements[0]?.balanceAfter ?? a.currentValue,
      }))
    );
  } catch {
    return Response.json([]); // model not available yet — restart server
  }
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    subtype?: string;
    issuer?: string;
    indexer?: string;
    rate?: number;
    investedValue?: number;
    currentValue?: number;
    purchaseDate?: string;
    maturityDate?: string;
    linkedAccountId?: string;
  };

  if (!body.name || !body.subtype || !body.issuer || !body.indexer || !body.purchaseDate) {
    return Response.json({ error: "name, subtype, issuer, indexer e purchaseDate são obrigatórios" }, { status: 400 });
  }

  try {
    const asset = await db.fixedIncomeAsset.create({
      data: {
        profileId: DEFAULT_PROFILE,
        name: body.name,
        subtype: body.subtype,
        issuer: body.issuer,
        indexer: body.indexer,
        rate: body.rate ?? null,
        investedValue: body.investedValue ?? 0,
        currentValue: body.currentValue ?? body.investedValue ?? 0,
        purchaseDate: new Date(body.purchaseDate),
        maturityDate: body.maturityDate ? new Date(body.maturityDate) : null,
        linkedAccountId: body.linkedAccountId ?? null,
      },
    });

    if ((body.investedValue ?? 0) > 0) {
      await db.fixedIncomeMovement.create({
        data: {
          assetId: asset.id,
          date: new Date(body.purchaseDate),
          type: "apply",
          amount: body.investedValue!,
          balanceAfter: body.investedValue,
          description: "Aplicação inicial",
        },
      });
    }

    return Response.json(asset, { status: 201 });
  } catch {
    return Response.json(
      { error: "Modelo de renda fixa indisponível — reinicie o servidor após a migration." },
      { status: 503 }
    );
  }
}
