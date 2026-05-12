import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; valueId: string }> }
) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { valueId } = await params;

  await prisma.patrimonyValue.delete({ where: { id: valueId } });

  return Response.json({ ok: true });
}
