import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateDailyBalances } from "@/lib/balance";
import type { PreviewRow } from "../preview/route";

interface ConfirmBody {
  batchId: string;
  accountId: string;
  bank: string;
  fileName: string;
  transactions: PreviewRow[];
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<ConfirmBody>;
  const { batchId, accountId, bank, fileName, transactions } = body;

  if (!batchId || !accountId || !bank || !fileName || !transactions?.length) {
    return Response.json({ error: "Dados incompletos para confirmar importação" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return Response.json({ error: "Conta não encontrada" }, { status: 404 });

  // Check duplicates one more time server-side
  const existing = await prisma.transaction.findMany({
    where: { accountId },
    select: { date: true, amount: true, normalizedName: true },
  });
  const existingSet = new Set(
    existing.map((t) => `${t.date.toISOString().slice(0, 10)}|${t.amount}|${t.normalizedName}`)
  );

  const toImport = transactions.filter((row) => {
    const key = `${row.date}|${row.amount}|${row.normalizedName}`;
    return !existingSet.has(key);
  });

  if (toImport.length === 0) {
    return Response.json({ imported: 0, skipped: transactions.length });
  }

  // Create ImportBatch
  const batch = await prisma.importBatch.create({
    data: {
      id: batchId,
      bank,
      fileName,
      fileType: fileName.split(".").pop() ?? "csv",
      rowCount: transactions.length,
      status: "processing",
    },
  });

  // Create all transactions
  await prisma.transaction.createMany({
    data: toImport.map((row) => ({
      accountId,
      importBatchId: batch.id,
      date: new Date(row.date + "T12:00:00Z"),
      description: row.description,
      normalizedName: row.normalizedName,
      amount: row.amount,
      type: row.type,
      categoryId: row.categoryId ?? undefined,
      categoryConfidence: row.categoryConfidence ?? undefined,
      categorySource: row.categorySource ?? undefined,
      balanceAfter: row.balanceAfter ?? undefined,
      originalCurrency: row.originalCurrency ?? undefined,
      originalAmount: row.originalAmount ?? undefined,
      exchangeRate: row.exchangeRate ?? undefined,
    })),
  });

  // Update batch status
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "done", rowCount: toImport.length },
  });

  // Recalculate daily balances from the oldest imported date
  const dates = toImport.map((r) => new Date(r.date + "T12:00:00Z"));
  const oldestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  await recalculateDailyBalances(accountId, oldestDate);

  return Response.json({ imported: toImport.length, skipped: transactions.length - toImport.length });
}
