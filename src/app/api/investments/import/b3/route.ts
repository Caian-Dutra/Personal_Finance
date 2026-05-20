import { validateSession } from "@/lib/auth";
import { parseB3Movimentacao } from "@/lib/parsers/b3-movimentacao";

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const rows = parseB3Movimentacao(buffer);

    // Group by ticker for preview
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = grouped.get(row.ticker) ?? [];
      list.push(row);
      grouped.set(row.ticker, list);
    }

    const preview = Array.from(grouped.entries()).map(([ticker, tickerRows]) => ({
      ticker,
      companyName: tickerRows.find((r) => r.companyName)?.companyName ?? "",
      assetClass: tickerRows[0].assetClass,
      operationCount: tickerRows.length,
      operations: tickerRows,
    }));

    return Response.json({ preview, totalRows: rows.length, fileName: file.name });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
