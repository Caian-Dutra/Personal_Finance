import type { BankParser, ParsedRow } from "@/types";
import { normalizeDescription, parseDate, splitCSV, cleanText } from "./base";

// Wise CSV: TransferWise ID,Date,Amount,Currency,Description,Exchange Rate,...
const wiseParser: BankParser = {
  bank: "wise",
  fileTypes: ["csv"],

  async parse(file: Buffer): Promise<ParsedRow[]> {
    const text = cleanText(file);
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    const header = splitCSV(lines[0]).map((h) => h.toLowerCase().trim());

    const dateIdx    = header.findIndex((h) => h === "date");
    const amountIdx  = header.findIndex((h) => h === "amount");
    const currIdx    = header.findIndex((h) => h === "currency");
    const descIdx    = header.findIndex((h) => h === "description" || h.includes("merchant"));
    const rateIdx    = header.findIndex((h) => h.includes("exchange rate") || h === "rate");
    const targetIdx  = header.findIndex((h) => h.includes("target amount") || h.includes("amount in"));

    if (dateIdx === -1 || amountIdx === -1) return [];

    const rows: ParsedRow[] = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = splitCSV(line);

      const rawDate   = cols[dateIdx]?.trim();
      const rawAmount = cols[amountIdx]?.trim() ?? "";
      const currency  = cols[currIdx]?.trim() ?? "USD";
      const rawDesc   = descIdx !== -1 ? (cols[descIdx]?.trim() ?? "") : "";
      const rawRate   = rateIdx !== -1 ? cols[rateIdx]?.trim() : undefined;
      const rawTarget = targetIdx !== -1 ? cols[targetIdx]?.trim() : undefined;

      const date = parseDate(rawDate ?? "");
      if (!date || !rawDesc) continue;

      const originalAmount = parseFloat(rawAmount);
      if (isNaN(originalAmount)) continue;

      const exchangeRate = rawRate ? parseFloat(rawRate) || undefined : undefined;

      // If BRL amount available (targetAmount), use it; otherwise convert via rate
      let amountBRL: number;
      if (currency === "BRL") {
        amountBRL = originalAmount;
      } else if (rawTarget) {
        amountBRL = parseFloat(rawTarget);
        if (isNaN(amountBRL)) amountBRL = exchangeRate ? originalAmount * exchangeRate : originalAmount;
      } else {
        amountBRL = exchangeRate ? originalAmount * exchangeRate : originalAmount;
      }

      const type = amountBRL < 0 ? ("debit" as const) : ("credit" as const);

      rows.push({
        date,
        description: rawDesc,
        normalizedName: normalizeDescription(rawDesc),
        amount: amountBRL,
        type,
        originalCurrency: currency !== "BRL" ? currency : undefined,
        originalAmount: currency !== "BRL" ? originalAmount : undefined,
        exchangeRate: currency !== "BRL" ? exchangeRate : undefined,
        rawData: Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""])),
      });
    }
    return rows;
  },

  detectFile(buffer: Buffer): boolean {
    const peek = buffer.toString("utf-8", 0, 200).toLowerCase();
    return peek.includes("transferwise") || peek.includes("wise id");
  },
};

export default wiseParser;
