import { validateSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await validateSession(req);
  return Response.json({ authenticated: session !== null });
}
