import { validateSession } from "@/lib/auth";
import { getYears } from "@/lib/external/fipe";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const brand = searchParams.get("brand") ?? "";
  const model = searchParams.get("model") ?? "";

  if (!type || !brand || !model) {
    return Response.json({ error: "type, brand e model são obrigatórios" }, { status: 400 });
  }

  try {
    const years = await getYears(type, brand, model);
    return Response.json(years);
  } catch {
    return Response.json({ error: "Erro ao consultar FIPE" }, { status: 502 });
  }
}
