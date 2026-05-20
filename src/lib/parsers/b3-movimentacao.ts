import * as XLSX from "xlsx";

export type OperationType =
  | "buy"
  | "sell"
  | "dividend"
  | "jcp"
  | "rendimento"
  | "split"
  | "reverse_split"
  | "bonus_shares"
  | "fraction_sale"
  | "fraction_debit"
  | "custody_transfer"
  | "lending"
  | "update"
  | "subscription_right"
  | "subscription_expired"
  | "redemption"
  | "fixed_income_apply"
  | "unknown";

export type AssetClass = "stock" | "fii" | "etf" | "bdr";

export interface B3Row {
  ticker: string;
  companyName: string;
  assetClass: AssetClass;
  broker: string;
  type: OperationType;
  date: string; // ISO YYYY-MM-DD
  quantity: number;
  unitPrice: number | null;
  totalValue: number | null;
  affectsPosition: boolean;
  splitRatio: number | null;
  direction: "credit" | "debit";
  rawMovimentacao: string;
}

// Mapeia movimentação B3 para tipo interno
function mapMovimentacao(movimentacao: string, direction: "credit" | "debit"): {
  type: OperationType;
  affectsPosition: boolean;
} {
  const m = movimentacao.trim().toLowerCase();

  if (m.includes("transferência - liquidação") || m.includes("transferencia - liquidacao")) {
    return { type: direction === "credit" ? "buy" : "sell", affectsPosition: true };
  }
  if (m === "dividendo") return { type: "dividend", affectsPosition: false };
  if (m.includes("juros sobre capital") || m === "jcp") return { type: "jcp", affectsPosition: false };
  if (m === "rendimento") return { type: "rendimento", affectsPosition: false };
  if (m === "desdobro" || m === "desdobramento") return { type: "split", affectsPosition: true };
  if (m === "grupamento") return { type: "reverse_split", affectsPosition: true };
  if (m.includes("bonificação") || m.includes("bonificacao")) return { type: "bonus_shares", affectsPosition: true };
  if (m.includes("leilão de fração") || m.includes("leilao de fracao")) return { type: "fraction_sale", affectsPosition: true };
  if (m.includes("fração em ativos") || m.includes("fracao em ativos")) return { type: "fraction_debit", affectsPosition: true };
  if (m.includes("direito de subscrição") || m.includes("direito de subscricao")) {
    if (m.includes("não exercido") || m.includes("nao exercido")) {
      return { type: "subscription_expired", affectsPosition: false };
    }
    return { type: "subscription_right", affectsPosition: false };
  }
  if (m === "resgate") return { type: "redemption", affectsPosition: true };
  if (m === "empréstimo" || m === "emprestimo") return { type: "lending", affectsPosition: false };
  if (m === "atualização" || m === "atualizacao") return { type: "update", affectsPosition: false };
  if (m.includes("transferência") || m.includes("transferencia")) return { type: "custody_transfer", affectsPosition: false };
  if (m.includes("aplicação") || m.includes("aplicacao")) return { type: "fixed_income_apply", affectsPosition: false };

  return { type: "unknown", affectsPosition: false };
}

function detectAssetClass(ticker: string, productName: string): AssetClass {
  const name = productName.toUpperCase();
  const t = ticker.toUpperCase();

  // BDR: 4 letras + 34
  if (/^[A-Z]{4}34$/.test(t)) return "bdr";

  // FII vs ETF: ambos podem terminar em 11
  if (t.endsWith("11")) {
    const isFii = name.includes("FDO INV IMOB") || name.includes("FII") || name.includes("FIAGRO");
    const isEtf = name.includes("ETF") || name.includes("FUNDO DE INDICE");
    if (isFii) return "fii";
    if (isEtf) return "etf";
    // Fallback por nome do ticker — fundos listados geralmente terminam em 11
    return "fii";
  }

  // Ações: 4 letras + 1 dígito (VALE3, PETR4, BBAS3)
  if (/^[A-Z]{4}\d$/.test(t)) return "stock";

  // Ações preferenciais/ordinárias com variações: BBDC4, ITSA4, GGBR4
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return "stock";

  return "stock";
}

function parseBrazilianNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "-" || val === "" || val === "–") return null;
  if (typeof val === "number") return val;
  const str = String(val).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function parseBrazilianDate(val: string): string {
  // "04/05/2026" -> "2026-05-04"
  const [d, m, y] = val.trim().split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function extractTicker(produto: string): { ticker: string; companyName: string } {
  const parts = produto.split(" - ");
  const ticker = parts[0].trim().toUpperCase();
  const companyName = parts.slice(1).join(" - ").trim();
  return { ticker, companyName };
}

export function parseB3Movimentacao(buffer: Buffer): B3Row[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

  // Find the Movimentação sheet (handle encoding variations)
  const sheetName =
    workbook.SheetNames.find((n) =>
      n.toLowerCase().includes("movimenta")
    ) ?? workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Aba 'Movimentação' não encontrada no arquivo B3");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
  });

  const result: B3Row[] = [];

  for (const raw of rows) {
    // Normalize column keys (handle encoding/spacing variations)
    const normalize = (key: string) =>
      key.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

    const get = (search: string): unknown => {
      for (const [key, val] of Object.entries(raw)) {
        if (normalize(key).includes(normalize(search))) return val;
      }
      return null;
    };

    const produto = String(get("produto") ?? "").trim();
    if (!produto || produto.toLowerCase() === "produto") continue; // skip header rows

    const entradaSaida = String(get("entrada") ?? get("saida") ?? "").toLowerCase();
    const movimentacao = String(get("movimenta") ?? "").trim();
    const dataVal = String(get("data") ?? "").trim();
    const instituicao = String(get("institui") ?? "").trim();

    if (!dataVal || !movimentacao || dataVal === "Data") continue;

    const direction: "credit" | "debit" = entradaSaida.includes("cred") ? "credit" : "debit";
    const { type, affectsPosition } = mapMovimentacao(movimentacao, direction);
    const { ticker, companyName } = extractTicker(produto);
    const assetClass = detectAssetClass(ticker, produto);

    const quantityRaw = parseBrazilianNumber(get("quantidade"));
    const unitPriceRaw = parseBrazilianNumber(get("pre") ?? get("unit"));
    const totalValueRaw = parseBrazilianNumber(get("valor"));

    const quantity = Math.abs(quantityRaw ?? 0);
    if (quantity === 0 && type !== "update") continue;

    let date: string;
    try {
      // Handle Excel date serial numbers
      if (typeof get("data") === "number") {
        const d = XLSX.SSF.parse_date_code(get("data") as number);
        date = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      } else {
        date = parseBrazilianDate(dataVal);
      }
    } catch {
      continue;
    }

    result.push({
      ticker,
      companyName,
      assetClass,
      broker: instituicao,
      type,
      date,
      quantity,
      unitPrice: unitPriceRaw,
      totalValue: totalValueRaw !== null ? Math.abs(totalValueRaw) : null,
      affectsPosition,
      splitRatio: null, // computed later for splits
      direction,
      rawMovimentacao: movimentacao,
    });
  }

  // Compute splitRatio for desdobros/grupamentos
  computeSplitRatios(result);

  return result;
}

function computeSplitRatios(rows: B3Row[]): void {
  // Group by ticker
  const byTicker = new Map<string, B3Row[]>();
  for (const row of rows) {
    const list = byTicker.get(row.ticker) ?? [];
    list.push(row);
    byTicker.set(row.ticker, list);
  }

  for (const tickerRows of Array.from(byTicker.values())) {
    const sorted = [...tickerRows].sort((a, b) => a.date.localeCompare(b.date));
    let position = 0;

    for (const row of sorted) {
      if (!row.affectsPosition) continue;

      if (row.type === "buy" || row.type === "bonus_shares") {
        position += row.quantity;
      } else if (row.type === "sell" || row.type === "redemption" || row.type === "fraction_sale") {
        position -= row.quantity;
      } else if (row.type === "split") {
        // quantity = new shares received
        // splitRatio = (before + received) / before
        if (position > 0) {
          row.splitRatio = (position + row.quantity) / position;
        }
        position += row.quantity;
      } else if (row.type === "reverse_split") {
        if (position > 0) {
          row.splitRatio = position / (position - row.quantity);
        }
        position -= row.quantity;
      }
    }
  }
}
