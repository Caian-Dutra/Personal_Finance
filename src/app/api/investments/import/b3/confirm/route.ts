import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { B3Row } from "@/lib/parsers/b3-movimentacao";

const DEFAULT_PROFILE = "default_profile";
const PROVENTO_TYPES = new Set(["dividend", "jcp", "rendimento", "redemption"]);

// Dynamic access — new models (invImportBatch, proventoReceived) may not be in
// the Prisma singleton if the server hasn't been restarted after migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function broker(r: B3Row): string {
  return r.broker ?? "";
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { fileName: string; rows: B3Row[] };

  if (!body.rows?.length) {
    return Response.json({ error: "Nenhuma operação para importar" }, { status: 400 });
  }

  // Create import batch (gracefully skips if server hasn't been restarted yet)
  let batchId: string | null = null;
  try {
    const batch = await db.invImportBatch.create({
      data: {
        fileName: body.fileName,
        source: "b3_movimentacao",
        rowCount: body.rows.length,
        status: "done",
      },
    });
    batchId = batch.id;
  } catch {
    // invImportBatch not available in current Prisma singleton — restart the server
  }

  const operationRows = body.rows.filter((r) => !PROVENTO_TYPES.has(r.type));
  const proventoRows = body.rows.filter((r) => PROVENTO_TYPES.has(r.type));

  // ------ InvestmentOperation ------------------------------------------------
  let operationsInserted = 0;

  if (operationRows.length > 0) {
    const dates = operationRows.map((r) => new Date(r.date).getTime());
    const existingCheck = await prisma.investmentOperation.findMany({
      where: {
        profileId: DEFAULT_PROFILE,
        date: {
          gte: new Date(Math.min(...dates)),
          lte: new Date(Math.max(...dates)),
        },
      },
      select: { ticker: true, date: true, type: true, quantity: true, broker: true },
    });

    const existingSet = new Set(
      existingCheck.map(
        (op) =>
          `${op.ticker}|${op.date.toISOString().slice(0, 10)}|${op.type}|${op.quantity}|${op.broker ?? ""}`
      )
    );

    const newOps = operationRows.filter((r) => {
      const key = `${r.ticker}|${r.date}|${r.type}|${r.quantity}|${broker(r)}`;
      return !existingSet.has(key);
    });

    if (newOps.length > 0) {
      // Use conditional spreading for new fields — safe for both old and new Prisma client
      const data = newOps.map((r) => ({
        profileId: DEFAULT_PROFILE,
        ticker: r.ticker,
        assetClass: r.assetClass,
        broker: r.broker ?? null,
        type: r.type,
        date: new Date(r.date),
        quantity: r.quantity,
        fees: 0,
        ...(r.companyName ? { companyName: r.companyName } : {}),
        ...(r.unitPrice !== null ? { unitPrice: r.unitPrice } : {}),
        ...(r.totalValue !== null ? { totalValue: r.totalValue } : {}),
        ...(r.affectsPosition !== undefined ? { affectsPosition: r.affectsPosition } : {}),
        ...(r.splitRatio !== null ? { splitRatio: r.splitRatio } : {}),
        ...(batchId ? { importBatchId: batchId } : {}),
      }));

      await prisma.investmentOperation.createMany({ data });
      operationsInserted = newOps.length;
    }
  }

  // ------ ProventoReceived ---------------------------------------------------
  let proventosInserted = 0;

  for (const r of proventoRows) {
    try {
      await db.proventoReceived.upsert({
        where: {
          ticker_date_type_broker: {
            ticker: r.ticker,
            date: new Date(r.date),
            type: r.type,
            broker: broker(r), // consistent: always string, never null
          },
        },
        create: {
          profileId: DEFAULT_PROFILE,
          ticker: r.ticker,
          assetClass: r.assetClass,
          type: r.type,
          date: new Date(r.date),
          quantity: r.quantity,
          unitValue: r.unitPrice ?? 0,
          totalValue: r.totalValue ?? (r.unitPrice ?? 0) * r.quantity,
          broker: broker(r),
        },
        update: {},
      });
      proventosInserted++;
    } catch {
      // proventoReceived not available yet, or duplicate — skip
    }
  }

  return Response.json({
    operations: operationsInserted,
    proventos: proventosInserted,
    skipped: body.rows.length - operationsInserted - proventosInserted,
    batchId,
    warning: batchId === null
      ? "Batch tracking indisponível — reinicie o servidor após a migration para habilitar."
      : undefined,
  });
}
