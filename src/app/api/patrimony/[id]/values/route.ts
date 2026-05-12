import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const values = await prisma.patrimonyValue.findMany({
    where: { itemId: id },
    orderBy: { date: "asc" },
  });

  return Response.json(values);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await req.json() as {
    date?: string;
    value?: number;
    source?: string;
  };

  if (!body.date || body.value === undefined) {
    return Response.json({ error: "date e value são obrigatórios" }, { status: 400 });
  }

  const item = await prisma.patrimonyItem.findUnique({ where: { id } });
  if (!item || !item.isActive) {
    return Response.json({ error: "Item não encontrado" }, { status: 404 });
  }

  const value = await prisma.patrimonyValue.create({
    data: {
      itemId: id,
      date: new Date(body.date),
      value: body.value,
      source: body.source ?? "manual",
    },
  });

  return Response.json(value, { status: 201 });
}
