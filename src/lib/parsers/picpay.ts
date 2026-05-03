import type { BankParser, ParsedRow } from "@/types";
import { normalizeDescription, parseDate, splitCSV, cleanText, parseBRNumber } from "./base";

// PicPay CSV: Data,Descrição,Valor,Tipo  (or similar variations)
const picpayParser: BankParser = {
  bank: "picpay",
  fileTypes: ["csv"],

  async parse(file: Buffer): Promise<ParsedRow[]> {
    const text = cleanText(file);
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    const header = splitCSV(lines[0]).map((h) => h.toLowerCase().trim());

    const dateIdx = header.findIndex((h) => h === "data" || h === "date");
    const descIdx = header.findIndex((h) => h.includes("descri") || h === "histórico" || h === "lancamento");
    const valIdx  = header.findIndex((h) => h === "valor" || h === "value" || h === "amount");
    const typeIdx = header.findIndex((h) => h === "tipo" || h === "type");

    if (dateIdx === -1 || valIdx === -1) return [];

    const rows: ParsedRow[] = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = splitCSV(line);

      const rawDate = cols[dateIdx]?.trim();
      const rawDesc = descIdx !== -1 ? (cols[descIdx]?.trim() ?? "") : "";
      const rawVal  = cols[valIdx]?.trim() ?? "";
      const rawType = typeIdx !== -1 ? cols[typeIdx]?.trim()?.toLowerCase() ?? "" : "";

      const date = parseDate(rawDate ?? "");
      if (!date || !rawDesc) continue;

      const value = parseBRNumber(rawVal);
      if (value === null) continue;

      const isCredit = rawType === "crédito" || rawType === "credito" || rawType === "entrada" || value > 0;
      const amount = isCredit ? Math.abs(value) : -Math.abs(value);

      const isTransfer = rawDesc.toLowerCase().startsWith("transferência") || rawDesc.toLowerCase().startsWith("transferencia");
      const type = isTransfer
        ? amount < 0 ? ("transfer_out" as const) : ("transfer_in" as const)
        : amount < 0 ? ("debit" as const) : ("credit" as const);

      rows.push({
        date,
        description: rawDesc,
        normalizedName: normalizeDescription(rawDesc),
        amount,
        type,
        rawData: Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""])),
      });
    }
    return rows;
  },
};

export default picpayParser;
