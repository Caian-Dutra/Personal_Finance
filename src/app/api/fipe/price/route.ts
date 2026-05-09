import { validateSession } from "@/lib/auth";
import { getPrice } from "@/lib/external/fipe";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const brand = searchParams.get("brand") ?? "";
  const model = searchParams.get("model") ?? "";
  const year = searchParams.get("year") ?? "";

  if (!type || !brand || !model || !year) {
    return Response.json({ error: "type, brand, model e year são obrigatórios" }, { status: 400 });
  }

  try {
    const data = await getPrice(type, brand, model, year);
    return Response.json(data);
  } catch {
    return Response.json({ error: "Erro ao consultar FIPE" }, { status: 502 });
  }
}
