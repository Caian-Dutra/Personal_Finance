import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await req.json() as {
    brandCode?: string;
    modelCode?: string;
    yearCode?: string;
    brandName?: string;
    modelName?: string;
    year?: number;
    fuel?: string;
    value?: number;
    vehicleType?: string;
  };

  if (!body.value || !body.brandName || !body.modelName || !body.year) {
    return Response.json({ error: "value, brandName, modelName e year são obrigatórios" }, { status: 400 });
  }

  const item = await prisma.patrimonyItem.findUnique({ where: { id } });
  if (!item || !item.isActive) {
    return Response.json({ error: "Item não encontrado" }, { status: 404 });
  }

  const [savedValue] = await Promise.all([
    prisma.patrimonyValue.create({
      data: {
        itemId: id,
        date: new Date(),
        value: body.value,
        source: "fipe",
      },
    }),
    prisma.patrimonyItem.update({
      where: { id },
      data: {
        fipeBrand: body.brandName,
        fipeModel: body.modelName,
        fipeYear: body.year,
        fipeFuel: body.fuel ?? null,
        ...(body.brandCode ? { fipeBrandCode: body.brandCode } : {}),
        ...(body.modelCode ? { fipeModelCode: body.modelCode } : {}),
        ...(body.yearCode ? { fipeYearCode: body.yearCode } : {}),
        ...(body.vehicleType ? { fipeVehicleType: body.vehicleType } : {}),
      },
    }),
  ]);

  return Response.json(savedValue, { status: 201 });
}
