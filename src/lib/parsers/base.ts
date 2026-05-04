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

/** Lowercase + strip accents for flexible header matching */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
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

/**
 * Decode buffer trying UTF-8 first, then Latin-1 (Windows-1252) as fallback.
 * Strips UTF-8 BOM and normalises line endings.
 */
export function cleanText(buffer: Buffer): string {
  // UTF-8 BOM
  const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const raw = hasBOM ? buffer.slice(3) : buffer;

  const utf8 = raw.toString("utf-8");
  // � = replacement character → invalid UTF-8 sequence → try Latin-1
  const text = utf8.includes("�") ? raw.toString("latin1") : utf8;

  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Parse a BR decimal string like "1.234,56" or "1234.56" → number */
export function parseBRNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  // Format: 1.234,56 (BR)
  if (/^-?[\d.]+,\d{1,2}$/.test(s)) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  }
  // Format: 1234.56 (US / Nubank)
  const n = parseFloat(s.replace(",", ""));
  return isNaN(n) ? null : n;
}
