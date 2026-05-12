import { prisma } from "@/lib/prisma";

export interface TransferPair {
  outId: string;
  inId: string;
  confidence: number;
  reason: "same_day" | "next_day" | "nearby";
  outAmount: number;
  inAmount: number;
  outDate: Date;
  inDate: Date;
  outAccountId: string;
  outAccountName: string;
  inAccountId: string;
  inAccountName: string;
  outDescription: string;
  inDescription: string;
}

const AUTO_LINK_THRESHOLD = 0.90;

/**
 * Busca pares de transferências internas entre contas do usuário.
 * Heurística: transfer_out de conta A ↔ transfer_in de conta B,
 * com mesmo valor absoluto e datas próximas.
 */
export async function findInternalTransferPairs(
  accountIds: string[],
  sinceDate?: Date
): Promise<TransferPair[]> {
  if (accountIds.length < 2) return [];

  const where = {
    accountId: { in: accountIds },
    type: { in: ["transfer_out", "transfer_in"] },
    isInternalTransfer: false,
    deletedAt: null as null,
    ...(sinceDate ? { date: { gte: new Date(sinceDate.getTime() - 3 * 86_400_000) } } : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: { account: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  const outs = transactions.filter((t) => t.type === "transfer_out");
  const ins  = transactions.filter((t) => t.type === "transfer_in");

  const pairs: TransferPair[] = [];
  const usedOut = new Set<string>();
  const usedIn  = new Set<string>();

  for (const out of outs) {
    if (usedOut.has(out.id)) continue;

    const candidates = ins
      .filter((t) => {
        if (usedIn.has(t.id)) return false;
        if (t.accountId === out.accountId) return false;
        // Valor dentro de 1 centavo (tolerância para taxas cambiais)
        if (Math.abs(Math.abs(out.amount) - Math.abs(t.amount)) > 0.01) return false;
        // Data dentro de 3 dias
        const days = Math.abs(out.date.getTime() - t.date.getTime()) / 86_400_000;
        return days <= 3;
      })
      .sort((a, b) =>
        Math.abs(a.date.getTime() - out.date.getTime()) -
        Math.abs(b.date.getTime() - out.date.getTime())
      );

    if (candidates.length === 0) continue;

    const best = candidates[0];
    const daysDiff = Math.abs(best.date.getTime() - out.date.getTime()) / 86_400_000;

    let confidence = 0.55;
    if (daysDiff < 0.5)  confidence += 0.40; // mesmo dia
    else if (daysDiff <= 1) confidence += 0.28; // dia seguinte
    else if (daysDiff <= 2) confidence += 0.14; // 2 dias

    const reason: TransferPair["reason"] =
      daysDiff < 0.5 ? "same_day" : daysDiff <= 1 ? "next_day" : "nearby";

    pairs.push({
      outId: out.id,
      inId: best.id,
      confidence: Math.min(confidence, 0.98),
      reason,
      outAmount: out.amount,
      inAmount: best.amount,
      outDate: out.date,
      inDate: best.date,
      outAccountId: out.accountId,
      outAccountName: out.account.name,
      inAccountId: best.accountId,
      inAccountName: best.account.name,
      outDescription: out.description,
      inDescription: best.description,
    });

    usedOut.add(out.id);
    usedIn.add(best.id);
  }

  return pairs.sort((a, b) => b.confidence - a.confidence);
}

/** Vincula dois lados de uma transferência interna. */
export async function linkTransferPair(outId: string, inId: string) {
  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: outId },
      data: { isInternalTransfer: true, linkedTransactionId: inId },
    }),
    prisma.transaction.update({
      where: { id: inId },
      data: { isInternalTransfer: true, linkedTransactionId: outId },
    }),
  ]);
}

/** Remove o vínculo entre dois lados de uma transferência. */
export async function unlinkTransferPair(txId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: txId } });
  if (!tx) return;

  const ops = [
    prisma.transaction.update({
      where: { id: txId },
      data: { isInternalTransfer: false, linkedTransactionId: null },
    }),
  ];

  if (tx.linkedTransactionId) {
    ops.push(
      prisma.transaction.update({
        where: { id: tx.linkedTransactionId },
        data: { isInternalTransfer: false, linkedTransactionId: null },
      })
    );
  }

  await prisma.$transaction(ops);
}

export { AUTO_LINK_THRESHOLD };
