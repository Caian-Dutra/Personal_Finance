import type { BankParser, ParsedRow } from "@/types";
import { normalizeDescription, parseDate, splitCSV, cleanText, parseBRNumber } from "./base";

// Inter CSV: Data;Tipo;Descrição;Valor  (semicolon-separated, BR decimal)
const interParser: BankParser = {
  bank: "inter",
  fileTypes: ["csv"],

  async parse(file: Buffer): Promise<ParsedRow[]> {
    const text = cleanText(file);
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    // Find header line (may have summary rows at the bottom)
    const headerLine = lines[0];
    const header = splitCSV(headerLine, ";").map((h) => h.toLowerCase().trim());

    const dateIdx = header.findIndex((h) => h === "data" || h === "date");
    const typeIdx = header.findIndex((h) => h === "tipo" || h === "histórico" || h === "historico");
    const descIdx = header.findIndex((h) => h.includes("descri") || h === "lancamento");
    const valIdx  = header.findIndex((h) => h === "valor");

    if (dateIdx === -1 || valIdx === -1) return [];

    const rows: ParsedRow[] = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = splitCSV(line, ";");

      const rawDate = cols[dateIdx]?.trim();
      const rawDesc = descIdx !== -1 ? (cols[descIdx]?.trim() ?? "") : (cols[typeIdx ?? 1]?.trim() ?? "");
      const rawType = typeIdx !== -1 ? cols[typeIdx]?.trim() ?? "" : "";
      const rawVal  = cols[valIdx]?.trim() ?? "";

      const date = parseDate(rawDate ?? "");
      if (!date) continue;

      const value = parseBRNumber(rawVal);
      if (value === null) continue;

      // Determine debit/credit from the Tipo column
      const ltype = rawType.toLowerCase();
      const isCredit =
        ltype.includes("crédito") || ltype.includes("credito") ||
        ltype.includes("pix recebido") || ltype.includes("ted recebido") ||
        ltype.includes("depósito") || ltype.includes("deposito") ||
        value > 0;

      const amount = isCredit ? Math.abs(value) : -Math.abs(value);
      const type = amount >= 0 ? ("credit" as const) : ("debit" as const);

      const desc = rawDesc || rawType;
      if (!desc) continue;

      rows.push({
        date,
        description: desc,
        normalizedName: normalizeDescription(desc),
        amount,
        type,
        rawData: Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""])),
      });
    }
    return rows;
  },
};

export default interParser;
