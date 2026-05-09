import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { expenseId } = await params;

  await prisma.patrimonyExpense.delete({ where: { id: expenseId } });

  return Response.json({ ok: true });
}
