import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/session_token=([^;]+)/);

  if (match) {
    await prisma.session.deleteMany({ where: { token: match[1] } });
  }

  const clearCookie = "session_token=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie } });
}
