export type { ParsedRow, BankParser } from "@/types";

export function normalizeDescription(raw: string): string {
  return raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s\-]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(PIX|TED|COMPRA|PAGAMENTO|TRANSFERENCIA)\s+/g, "")
    .replace(/\s+\d{2}\/\d{2}(\s|$)/g, " ")
    .trim();
}

/** Parses dd/mm/yyyy, dd/mm/yy or yyyy-mm-dd → ISO date string 'YYYY-MM-DD' */
export function parseDate(raw: string): string | null {
  const s = raw.trim();

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd/mm/yyyy
  const dmy4 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy4) return `${dmy4[3]}-${dmy4[2]}-${dmy4[1]}`;

  // dd/mm/yy
  const dmy2 = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (dmy2) {
    const year = parseInt(dmy2[3]) >= 50 ? `19${dmy2[3]}` : `20${dmy2[3]}`;
    return `${year}-${dmy2[2]}-${dmy2[1]}`;
  }

  return null;
}

/** Robust CSV line splitter – handles quoted fields with delimiter inside */
export function splitCSV(line: string, delimiter = ","): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quote ""
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delimiter && !inQ) {
      cols.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

/** Strip UTF-8 BOM and normalise line endings */
export function cleanText(buffer: Buffer): string {
  let text = buffer.toString("utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Parse a BR decimal string like "1.234,56" or "1234.56" → number */
export function parseBRNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  // Format: 1.234,56 (BR)
  if (/^\-?[\d.]+,\d{1,2}$/.test(s)) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  }
  // Format: 1234.56 (US)
  const n = parseFloat(s.replace(",", ""));
  return isNaN(n) ? null : n;
}
