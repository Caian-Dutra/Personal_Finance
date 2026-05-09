import { validateSession } from "@/lib/auth";
import { getBrands } from "@/lib/external/fipe";

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "carros" | "motos" | "caminhoes" | null;

  if (!type || !["carros", "motos", "caminhoes"].includes(type)) {
    return Response.json({ error: "type deve ser carros, motos ou caminhoes" }, { status: 400 });
  }

  try {
    const brands = await getBrands(type);
    return Response.json(brands);
  } catch {
    return Response.json({ error: "Erro ao consultar FIPE" }, { status: 502 });
  }
}
