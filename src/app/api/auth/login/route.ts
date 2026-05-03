import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const DEV_USERNAME = "admin";
const DEV_PASSWORD = "admin";

// Sessão válida por 30 dias
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const body = await req.json() as { username?: string; password?: string };

  if (body.username !== DEV_USERNAME || body.password !== DEV_PASSWORD) {
    return Response.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({ data: { token, expiresAt } });

  const cookieValue = [
    `session_token=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Expires=${expiresAt.toUTCString()}`,
  ].join("; ");

  return Response.json({ ok: true }, {
    headers: { "Set-Cookie": cookieValue },
  });
}
