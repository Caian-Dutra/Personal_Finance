export const BANK_CONFIG: Record<string, { label: string; color: string; initial: string }> = {
  nubank:  { label: "Nubank",       color: "#8B5CF6", initial: "N" },
  inter:   { label: "Banco Inter",  color: "#F97316", initial: "I" },
  picpay:  { label: "PicPay",       color: "#16A34A", initial: "P" },
  wise:    { label: "Wise",         color: "#2563EB", initial: "W" },
  other:   { label: "Outro",        color: "#6B7280", initial: "?" },
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking:   "Conta Corrente",
  savings:    "Poupança",
  credit:     "Cartão de Crédito",
  investment: "Investimentos",
  wallet:     "Carteira Digital",
};

export function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}
