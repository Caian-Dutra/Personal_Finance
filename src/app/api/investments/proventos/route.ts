import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PROFILE = "default_profile";

function needsRestart(e: unknown): boolean {
  return e instanceof TypeError && e.message.includes("Cannot read properties of undefined");
}

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const ticker = searchParams.get("ticker");
  const type = searchParams.get("type");

  try {
    const proventos = await prisma.proventoReceived.findMany({
      where: {
        profileId: DEFAULT_PROFILE,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
        ...(ticker ? { ticker } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { date: "desc" },
    });

    const byMonth = new Map<string, number>();
    for (const p of proventos) {
      const month = new Date(p.date).toISOString().slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + p.totalValue);
    }

    const monthlyChart = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    return Response.json({
      proventos,
      monthlyChart,
      total: proventos.reduce((s, p) => s + p.totalValue, 0),
    });
  } catch (e) {
    if (needsRestart(e)) {
      return Response.json(
        { error: "ProventoReceived indisponível — reinicie o servidor após npx prisma generate.", proventos: [], monthlyChart: [], total: 0 },
        { status: 200 } // return 200 so UI degrades gracefully
      );
    }
    throw e;
  }
}
