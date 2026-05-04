import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getParser } from "@/lib/parsers";
import { categorizeTransaction } from "@/lib/categorizer";
import { randomUUID } from "crypto";
import type { ParsedRow } from "@/types";

export interface PreviewRow extends ParsedRow {
  isDuplicate: boolean;
  categoryId: string | null;
  categoryConfidence: number;
  categorySource: string;
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const file      = formData.get("file") as File | null;
  const bank      = formData.get("bank") as string | null;
  const accountId = formData.get("accountId") as string | null;

  if (!file || !bank || !accountId) {
    return Response.json({ error: "file, bank e accountId são obrigatórios" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return Response.json({ error: "Conta não encontrada" }, { status: 404 });

  const parser = getParser(bank);
  if (!parser) return Response.json({ error: `Parser não encontrado para o banco '${bank}'` }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  let rows: ParsedRow[];
  try {
    rows = await parser.parse(buffer, file.name.split(".").pop() ?? "csv");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao processar arquivo";
    return Response.json({ error: msg }, { status: 422 });
  }

  if (rows.length === 0) {
    return Response.json({ error: "Nenhuma transação encontrada no arquivo" }, { status: 422 });
  }

  // Check duplicates: same accountId + date + amount + normalizedName
  const existing = await prisma.transaction.findMany({
    where: { accountId },
    select: { date: true, amount: true, normalizedName: true },
  });

  const existingSet = new Set(
    existing.map((t) => `${t.date.toISOString().slice(0, 10)}|${t.amount}|${t.normalizedName}`)
  );

  const preview: PreviewRow[] = await Promise.all(
    rows.map(async (row) => {
      const key = `${row.date}|${row.amount}|${row.normalizedName}`;
      const isDuplicate = existingSet.has(key);
      const cat = await categorizeTransaction(row.normalizedName);
      return {
        ...row,
        isDuplicate,
        categoryId: cat.categoryId,
        categoryConfidence: cat.confidence,
        categorySource: cat.source,
      };
    })
  );

  return Response.json({ transactions: preview, batchId: randomUUID() });
}
