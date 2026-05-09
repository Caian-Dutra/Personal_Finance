---
name: Project Setup Status
description: Sprint progress and what has been built so far in the FinanceOS project
type: project
---

Sprint 0 concluído: Next.js 14, Prisma 5.22, schema completo (PatrimonyItem/Value/Expense, Transaction, Category, Account etc.), seed rodado, estrutura de pastas criada.

Sprint 1-3 concluídos (em outro PC, pendente merge): Auth, accounts, parsers Nubank/Inter, importação, transações, categorização, transferências internas, saldo diário.

Sprint 4 (Dashboard): Concluído em outro PC — pendente merge para main.

Sprint 8 (Patrimônio Físico): **Implementado nesta sessão**.

**Why:** Usuário pulou o Dashboard (já feito em outro PC) e pediu implementação do módulo de Patrimônio.

**Arquivos criados:**
- `src/app/api/patrimony/route.ts` — GET/POST items
- `src/app/api/patrimony/[id]/route.ts` — GET/PATCH/DELETE item
- `src/app/api/patrimony/[id]/values/route.ts` — GET/POST value history
- `src/app/api/patrimony/[id]/values/[valueId]/route.ts` — DELETE value
- `src/app/api/patrimony/[id]/expenses/route.ts` — GET/POST linked expenses
- `src/app/api/patrimony/[id]/expenses/[expenseId]/route.ts` — DELETE expense link
- `src/app/api/patrimony/[id]/fipe/route.ts` — POST: fetch & save FIPE value
- `src/app/api/fipe/brands|models|years|price/route.ts` — FIPE API proxies
- `src/components/patrimony/` — PatrimonyChart, FipeSearchDialog, PatrimonyItemDialog, PatrimonyValueDialog, PatrimonyExpensesPanel, PatrimonyItemCard, PatrimonyClient
- `src/app/(app)/patrimony/page.tsx` — replaced placeholder
- `src/components/ui/textarea.tsx` — added textarea shadcn component
- `src/types/index.ts` — added PatrimonyItemFull, PatrimonyValue, PatrimonyExpenseLinked, FipeResult types

**How to apply:** The patrimony module is feature-complete for Sprint 8. When starting new sessions, the next sprint is investments (Sprint 9).
