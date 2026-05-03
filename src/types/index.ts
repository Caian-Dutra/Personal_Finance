// Tipos globais compartilhados do FinanceOS

export interface ParsedRow {
  date: string;
  description: string;
  normalizedName: string;
  amount: number;
  type: "debit" | "credit" | "transfer_out" | "transfer_in";
  balanceAfter?: number;
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  rawData?: Record<string, string>;
}

export interface BankParser {
  bank: string;
  fileTypes: ("csv" | "pdf" | "xlsx")[];
  parse(file: Buffer, fileType: string): Promise<ParsedRow[]>;
  detectFile?(buffer: Buffer): boolean;
}

export interface CategorizationResult {
  categoryId: string | null;
  confidence: number;
  source: "rule_exact" | "rule_contains" | "rule_regex" | "none";
}

export interface TransactionCreateInput {
  accountId: string;
  categoryId?: string;
  date: string;
  description: string;
  normalizedName: string;
  amount: number;
  type: string;
  isInternalTransfer?: boolean;
  linkedTransactionId?: string;
  balanceAfter?: number;
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  importBatchId?: string;
  notes?: string;
  tags?: string[];
}

export interface AccountCreateInput {
  profileId: string;
  bank: string;
  name: string;
  type: string;
  currency?: string;
  initialBalance?: number;
  initialDate?: string;
  color?: string;
}

export interface SplitInput {
  amount: number;
  categoryId?: string;
  description?: string;
  notes?: string;
}

export interface CategoryRuleInput {
  categoryId: string;
  pattern: string;
  matchType: "exact" | "contains" | "regex";
  priority?: number;
  applyToFuture?: boolean;
  applyToAll?: boolean;
}

export interface InvestmentOperationInput {
  profileId: string;
  ticker: string;
  type: string;
  assetClass: string;
  date: string;
  quantity: number;
  unitPrice: number;
  fees?: number;
  broker?: string;
  notes?: string;
}

export interface CryptoOperationInput {
  walletId: string;
  coin: string;
  coingeckoId?: string;
  type: string;
  date: string;
  quantity: number;
  unitPriceBRL: number;
  unitPriceUSD?: number;
  exchangeRate?: number;
  fees?: number;
  notes?: string;
  importBatchId?: string;
}

export interface PatrimonyItemInput {
  profileId: string;
  name: string;
  type: string;
  subtype?: string;
  purchaseDate: string;
  purchaseValue: number;
  acquisitionType: string;
  fipeBrand?: string;
  fipeModel?: string;
  fipeYear?: number;
  fipeFuel?: string;
  notes?: string;
}
