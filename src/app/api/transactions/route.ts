import { validateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const accountId = searchParams.get("account") ?? undefined;
  const categoryId = searchParams.get("category") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const where: {
    deletedAt: null;
    accountId?: string;
    categoryId?: string | null;
    type?: string;
    normalizedName?: { contains: string };
    date?: { gte?: Date; lte?: Date };
  } = {
    deletedAt: null,
  };

  if (accountId) where.accountId = accountId;
  if (categoryId) {
    if (categoryId === "uncategorized") {
      where.categoryId = null;
    } else {
      where.categoryId = categoryId;
    }
  }
  if (type) where.type = type;
  if (search) {
    where.normalizedName = { contains: search.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "") };
  }
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from + "T00:00:00Z");
    if (to) where.date.lte = new Date(to + "T23:59:59Z");
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, bank: true, color: true } },
        category: { select: { id: true, name: true, color: true, icon: true, parentId: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({ where }),
  ]);

  return Response.json({
    transactions,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
