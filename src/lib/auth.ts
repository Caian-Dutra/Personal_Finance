import { prisma } from "@/lib/prisma";

export async function validateSession(req: Request): Promise<{ id: string } | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/session_token=([^;]+)/);
  if (!match) return null;

  const token = match[1];
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) return null;

  return { id: session.id };
}
