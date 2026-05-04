import type { BankParser, ParsedRow } from "@/types";
import { normalizeDescription, normalizeHeader, parseDate, splitCSV, cleanText, parseBRNumber } from "./base";

/**
 * Real Inter CSV format:
 *   (metadata rows)
 *    Extrato Conta Corrente
 *   Conta ;17914850
 *   Período ;04/04/2026 a 03/05/2026
 *   Saldo ;37,34
 *   (empty line)
 *   Data Lançamento;Histórico;Descrição;Valor;Saldo
 *   03/05/2026;Débito - Inter Tag;03/05/2026 12:45*br-101 - Free Flow Mangaratiba - Norte;-7,51;37,34
 *   30/04/2026;Pix recebido;Miguel Vecchi Wendling;70,00;143,20
 */

function extractInterName(historico: string, descricao: string): string {
  const h = historico.toLowerCase();

  // Inter Tag: "DD/MM/YYYY HH:MM*road - TollName - Direction"
  if (/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\*/.test(descricao)) {
    const afterAsterisk = descricao.split("*")[1] ?? "";
    // Split only on " - " (with spaces) to preserve "br-101"
    // parts: ["br-101", "Free Flow Mangaratiba", "Norte"]
    const parts = afterAsterisk.split(" - ");
    const name = parts.length >= 2 ? (parts[1]?.trim() ?? afterAsterisk) : afterAsterisk;
    return normalizeDescription(name);
  }

  // Pix: description is the sender/recipient name
  if (h.includes("pix")) {
    return normalizeDescription(descricao);
  }

  // B3 events: "* Prov * Juros S/capital 15  B3sa3"
  if (h.includes("b3") || h.includes("evento")) {
    return normalizeDescription(descricao.replace(/^\*\s*Prov\s*\*\s*/i, "PROV ").trim());
  }

  return normalizeDescription(descricao || historico);
}

function detectType(historico: string, amount: number): ParsedRow["type"] {
  const h = historico.toLowerCase();
  if (h.includes("pix recebido") || h.includes("credito") || h.includes("crédito")) {
    if (h.includes("pix")) return "transfer_in";
    return "credit";
  }
  if (h.includes("pix enviado") || h.includes("pix transferencia")) return "transfer_out";
  return amount >= 0 ? "credit" : "debit";
}

const interParser: BankParser = {
  bank: "inter",
  fileTypes: ["csv"],

  async parse(file: Buffer): Promise<ParsedRow[]> {
    const text = cleanText(file);
    const lines = text.split("\n");

    // Find the actual header row — skip metadata rows at the top
    // Look for a line with both a date-like column AND a value/historico column
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const normalized = normalizeHeader(lines[i]);
      if (
        (normalized.includes("data") || normalized.includes("lancamento")) &&
        (normalized.includes("valor") || normalized.includes("historico"))
      ) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      console.warn("[inter] Header row not found");
      return [];
    }

    const rawHeaders = splitCSV(lines[headerIdx], ";");
    const header = rawHeaders.map(normalizeHeader);

    const dateIdx  = header.findIndex((h) => h.startsWith("data"));
    const histIdx  = header.findIndex((h) => h === "historico" || h === "tipo");
    const descIdx  = header.findIndex((h) => h.startsWith("descri"));
    const valIdx   = header.findIndex((h) => h === "valor");
    const saldoIdx = header.findIndex((h) => h === "saldo");

    if (dateIdx === -1 || valIdx === -1) {
      console.warn("[inter] Colunas data/valor não encontradas. Headers:", header);
      return [];
    }

    const rows: ParsedRow[] = [];

    for (const line of lines.slice(headerIdx + 1)) {
      if (!line.trim()) continue;
      const cols = splitCSV(line, ";");
      if (cols.length < 3) continue;

      const rawDate  = cols[dateIdx]?.trim() ?? "";
      const historico = histIdx !== -1 ? (cols[histIdx]?.trim() ?? "") : "";
      const descricao = descIdx !== -1 ? (cols[descIdx]?.trim() ?? "") : "";
      const rawVal   = cols[valIdx]?.trim() ?? "";
      const rawSaldo = saldoIdx !== -1 ? (cols[saldoIdx]?.trim() ?? "") : "";

      const date = parseDate(rawDate);
      if (!date) continue;

      const amount = parseBRNumber(rawVal);
      if (amount === null) continue;

      const type = detectType(historico, amount);
      const label = descricao || historico;
      if (!label) continue;

      const balanceAfter = rawSaldo ? parseBRNumber(rawSaldo) ?? undefined : undefined;

      rows.push({
        date,
        description: label,
        normalizedName: extractInterName(historico, descricao),
        amount,
        type,
        balanceAfter,
        rawData: Object.fromEntries(rawHeaders.map((h, i) => [h, cols[i] ?? ""])),
      });
    }

    return rows;
  },

  detectFile(buffer: Buffer): boolean {
    const peek = cleanText(buffer).slice(0, 500).toLowerCase();
    return (
      peek.includes("extrato conta corrente") ||
      peek.includes("banco inter") ||
      (peek.includes("historico") && peek.includes("lancamento"))
    );
  },
};

export default interParser;
