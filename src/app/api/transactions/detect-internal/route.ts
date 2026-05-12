import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findInternalTransferPairs } from "@/lib/internalTransferDetector";

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({ select: { id: true } });
  const accountIds = accounts.map((a) => a.id);

  const pairs = await findInternalTransferPairs(accountIds);

  return Response.json({ pairs });
}
