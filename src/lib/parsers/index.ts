import type { BankParser } from "@/types";
import nubankParser from "./nubank";
import interParser  from "./inter";
import picpayParser from "./picpay";
import wiseParser   from "./wise";

const parsers: BankParser[] = [nubankParser, interParser, picpayParser, wiseParser];

export function getParser(bank: string): BankParser | null {
  return parsers.find((p) => p.bank === bank) ?? null;
}

export { parsers };
