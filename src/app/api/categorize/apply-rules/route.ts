import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categorizeTransaction } from "@/lib/categorizer";

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { overwriteManual?: boolean };
  const overwriteManual = body.overwriteManual ?? false;

  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      ...(overwriteManual ? {} : { categorySource: { not: "manual" } }),
    },
    select: { id: true, normalizedName: true },
  });

  let updated = 0;

  for (const tx of transactions) {
    const result = await categorizeTransaction(tx.normalizedName);
    if (result.categoryId) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          categoryId: result.categoryId,
          categoryConfidence: result.confidence,
          categorySource: result.source,
        },
      });
      updated++;
    }
  }

  return Response.json({ total: transactions.length, updated });
}
