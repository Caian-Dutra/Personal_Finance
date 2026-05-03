import type { BankParser, ParsedRow } from "@/types";
import { normalizeDescription, parseDate, splitCSV, cleanText } from "./base";

// Nubank extrato CSV: date,title,amount
// Nubank fatura CSV:  date,category,title,amount
const nubankParser: BankParser = {
  bank: "nubank",
  fileTypes: ["csv"],

  async parse(file: Buffer): Promise<ParsedRow[]> {
    const text = cleanText(file);
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    const header = splitCSV(lines[0].toLowerCase());
    const dateIdx   = header.findIndex((h) => h === "date");
    const titleIdx  = header.findIndex((h) => h === "title" || h === "description");
    const amountIdx = header.findIndex((h) => h === "amount");

    if (dateIdx === -1 || titleIdx === -1 || amountIdx === -1) return [];

    const rows: ParsedRow[] = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = splitCSV(line);

      const rawDate   = cols[dateIdx]?.trim();
      const rawTitle  = cols[titleIdx]?.trim() ?? "";
      const rawAmount = cols[amountIdx]?.trim() ?? "";

      const date = parseDate(rawDate ?? "");
      if (!date || !rawTitle) continue;

      const amount = parseFloat(rawAmount);
      if (isNaN(amount)) continue;

      // Nubank CSV: negativo = despesa, positivo = crédito (estorno/cashback)
      const type = amount >= 0 ? ("credit" as const) : ("debit" as const);

      rows.push({
        date,
        description: rawTitle,
        normalizedName: normalizeDescription(rawTitle),
        amount,
        type,
        rawData: Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""])),
      });
    }
    return rows;
  },

  detectFile(buffer: Buffer): boolean {
    const peek = buffer.toString("utf-8", 0, 300).toLowerCase();
    return peek.startsWith("date,title") || peek.startsWith("date,category,title");
  },
};

export default nubankParser;
