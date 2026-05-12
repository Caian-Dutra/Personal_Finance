import { validateSession } from "@/lib/auth";
import { getModels } from "@/lib/external/fipe";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const brand = searchParams.get("brand") ?? "";

  if (!type || !brand) {
    return Response.json({ error: "type e brand são obrigatórios" }, { status: 400 });
  }

  try {
    const data = await getModels(type, brand);
    return Response.json(data.modelos);
  } catch {
    return Response.json({ error: "Erro ao consultar FIPE" }, { status: 502 });
  }
}
