import type { BankParser, ParsedRow } from "@/types";
import { normalizeDescription, normalizeHeader, parseDate, splitCSV, cleanText } from "./base";

/**
 * Strips Nubank-specific prefixes from the description before normalizing.
 * Goal: "Compra no débito - Auto Posto Trevo"                     → "AUTO POSTO TREVO"
 *       "Transferência enviada pelo Pix - João Silva - •••.123 …" → "JOAO SILVA"
 */
function extractMerchantName(raw: string): string {
  // Strip accents first so patterns work regardless of file encoding
  let s = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  // Remove Nubank action prefixes (no accents needed after normalization above)
  s = s
    .replace(/^Compra no debito\s*-\s*/i, "")
    .replace(/^Compra no credito\s*-\s*/i, "")
    .replace(/^Pagamento de boleto efetuado\s*-\s*/i, "BOLETO ")
    .replace(/^Pagamento de fatura.*/i, "PAGAMENTO FATURA")
    .replace(/^Aplicac[ao][ao]\s+/i, "APLICACAO ")
    .replace(/^Resgate\s+/i, "RESGATE ")
    .replace(/^Saque\s*/i, "SAQUE")
    .replace(/^IOF\s*/i, "IOF");

  const isTransfer = /transferencia/i.test(s);
  if (isTransfer) {
    // Remove "Transferencia <verb phrase> - " to get to the name
    // e.g. "Transferencia enviada pelo Pix - " or "Transferencia Recebida - "
    s = s.replace(/^Transferencia\s+[a-zA-Z\s]+\s*-\s*/i, "");
    // Keep only the name segment (before CPF/CNPJ/bank details)
    const parts = s.split(/\s*-\s*/);
    s = parts[0] ?? s;
  }

  return normalizeDescription(s.trim());
}

// Real Nubank extrato CSV format:
//   Data,Valor,Identificador,Descrição
//
// Fatura CSV format:
//   date,category,title,amount  (English headers, older format)
//
// Both are handled by normalizing headers before matching.

const nubankParser: BankParser = {
  bank: "nubank",
  fileTypes: ["csv"],

  async parse(file: Buffer): Promise<ParsedRow[]> {
    const text = cleanText(file);
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    // Normalize headers: strip accents + lowercase for flexible matching
    const rawHeaders = splitCSV(lines[0]);
    const header     = rawHeaders.map(normalizeHeader);

    // Resolve column indices — accepts both Portuguese and English names
    const dateIdx = header.findIndex((h) => h === "data" || h === "date");
    const amtIdx  = header.findIndex((h) => h === "valor" || h === "amount");
    const descIdx = header.findIndex(
      (h) => h.startsWith("descri") || h === "title" || h === "description"
    );

    if (dateIdx === -1 || amtIdx === -1 || descIdx === -1) {
      console.warn("[nubank] Colunas não encontradas. Headers:", header);
      return [];
    }

    const rows: ParsedRow[] = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = splitCSV(line);

      const rawDate = cols[dateIdx]?.trim() ?? "";
      const rawDesc = cols[descIdx]?.trim() ?? "";
      const rawAmt  = cols[amtIdx]?.trim()  ?? "";

      const date = parseDate(rawDate);
      if (!date || !rawDesc) continue;

      // Nubank uses US decimal (e.g. -89.90), but handle BR too
      const amount = parseFloat(rawAmt.replace(",", "."));
      if (isNaN(amount)) continue;

      // Negative = debit, positive = credit (estorno, cashback, Pix recebido)
      const isTransferOut = /Transferência enviada|Pix enviado/i.test(rawDesc);
      const isTransferIn  = /Transferência [Rr]ecebida|Pix recebido/i.test(rawDesc);

      const type =
        isTransferOut ? ("transfer_out" as const)
        : isTransferIn ? ("transfer_in" as const)
        : amount >= 0  ? ("credit" as const)
        :                ("debit" as const);

      rows.push({
        date,
        description: rawDesc,
        normalizedName: extractMerchantName(rawDesc),
        amount,
        type,
        rawData: Object.fromEntries(rawHeaders.map((h, i) => [h, cols[i] ?? ""])),
      });
    }
    return rows;
  },

  detectFile(buffer: Buffer): boolean {
    const peek = cleanText(buffer).slice(0, 300).toLowerCase();
    // Real format: "data,valor,identificador,descrição"
    // Old format:  "date,title,amount" or "date,category,title,amount"
    return (
      peek.startsWith("data,valor") ||
      peek.startsWith("date,title") ||
      peek.startsWith("date,category,title")
    );
  },
};

export default nubankParser;
