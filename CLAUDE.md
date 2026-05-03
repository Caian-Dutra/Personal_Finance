# FinanceOS — Instruções para o Claude Code

> Este arquivo é lido automaticamente pelo Claude Code em cada sessão.
> Siga todas as instruções abaixo sem exceção. Se tiver dúvida entre duas abordagens, consulte este arquivo primeiro.

---

## 1. O que é este projeto

Aplicação web **local** (roda em `localhost:3000`) de controle de finanças pessoais.
Stack: **Next.js 14 (App Router) + TypeScript + Prisma + SQLite + shadcn/ui + Recharts**.
Sem Docker. Sem servidor separado. Um único `npm run dev` inicia tudo.

Documentos de referência (leia antes de implementar qualquer módulo):
- `docs/PRD_v1.1.docx` — o que o sistema deve fazer
- `docs/TechSpec_v1.0.docx` — como deve ser feito (schema, rotas, estrutura)
- `docs/Wireframes_v1.0.docx` — como as telas devem ser

---

## 2. Regras absolutas de código

### Nunca faça sem perguntar
- Alterar o `schema.prisma` sem criar uma migration (`npx prisma migrate dev --name <nome>`)
- Renomear tabelas ou campos existentes (quebra dados do usuário)
- Instalar dependências não listadas no Tech Spec sem avisar
- Criar arquivos fora da estrutura de pastas definida no Tech Spec (seção 1.2)
- Usar `any` em TypeScript — use tipos explícitos ou `unknown`
- Deletar dados sem soft-delete ou confirmação explícita do usuário
- Fazer chamadas a APIs externas (CoinGecko, Brapi, FIPE) diretamente do componente React — sempre via API Route

### Sempre faça
- Rodar `npx prisma generate` após qualquer mudança no `schema.prisma`
- Validar inputs nas API Routes antes de tocar no banco
- Retornar erros no formato `{ error: string, code?: string }`
- Usar o singleton do Prisma client em `src/lib/prisma.ts`
- Tratar datas sempre em UTC no banco — converter para horário local apenas na exibição
- Usar `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` para formatar moeda
- Usar `Intl.DateTimeFormat('pt-BR')` para formatar datas

---

## 3. Convenções de nomenclatura

| Elemento | Convenção | Exemplo |
|---|---|---|
| Arquivos de componente | PascalCase | `TransactionTable.tsx` |
| Arquivos de lib/util | camelCase | `categorizer.ts` |
| API Routes | kebab-case nas pastas | `app/api/daily-balances/route.ts` |
| Variáveis e funções | camelCase | `parseNubankCSV()` |
| Tipos e interfaces | PascalCase | `ParsedRow`, `TransactionInput` |
| Constantes globais | UPPER_SNAKE | `MAX_IMPORT_ROWS` |
| Campos do banco (Prisma) | camelCase | `normalizedName`, `isInternalTransfer` |

---

## 4. Estrutura de pastas (não altere sem motivo)

```
src/
├── app/
│   ├── (auth)/login/        # Tela de login
│   ├── (app)/               # Rotas protegidas (requer sessão)
│   │   ├── layout.tsx       # Sidebar + Header
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── import/
│   │   ├── investments/
│   │   ├── crypto/
│   │   ├── patrimony/
│   │   └── settings/
│   └── api/                 # Todas as API Routes aqui
├── components/
│   ├── ui/                  # Apenas componentes shadcn — não modifique
│   ├── charts/              # Wrappers de Recharts
│   ├── transactions/
│   ├── import/
│   └── layout/
├── lib/
│   ├── prisma.ts            # Singleton — não duplique
│   ├── auth.ts
│   ├── parsers/             # Um arquivo por banco
│   ├── categorizer.ts
│   ├── balance.ts
│   └── external/            # brapi.ts, coingecko.ts, fipe.ts
└── types/index.ts           # Tipos globais compartilhados
```

---

## 5. Banco de dados

- **Provider:** SQLite (arquivo `financeos.db` na raiz — está no `.gitignore`)
- **ORM:** Prisma — use sempre o client, nunca SQL raw exceto para queries de performance comprovada
- **Migrations:** toda mudança de schema = `npx prisma migrate dev --name descricao-curta`
- **Seed:** `npx prisma db seed` — recria categorias padrão, não apaga dados do usuário
- **Studio:** `npx prisma studio` para inspecionar dados durante desenvolvimento

### Singleton obrigatório (src/lib/prisma.ts)
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

---

## 6. Autenticação local

- Senha única armazenada como bcrypt hash em `AppConfig` (key = `password_hash`)
- Sessão via cookie `session_token` (HTTP-only, SameSite=Strict)
- Token da sessão: UUID v4 armazenado na tabela `Session` com `expiresAt`
- Middleware em `src/middleware.ts` protege todas as rotas `(app)` e `/api/**` (exceto `/api/auth/**`)
- Sem JWT, sem NextAuth no MVP

### Verificação de sessão nas API Routes
```typescript
import { validateSession } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await validateSession(req)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // ...
}
```

---

## 7. Parsers de importação

Cada parser fica em `src/lib/parsers/<banco>.ts` e exporta um objeto que implementa `BankParser`.

### Normalização de nome (obrigatória e idêntica em todos os parsers)
```typescript
export function normalizeDescription(raw: string): string {
  return raw
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s\-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(PIX|TED|COMPRA|PAGAMENTO|TRANSFERENCIA)\s+/g, '')
    .replace(/\s+\d{2}\/\d{2}(\s|$)/g, ' ')
    .trim()
}
```

### Regra de sinal de valor
- Débito (saída de dinheiro): `amount` é **negativo**
- Crédito (entrada de dinheiro): `amount` é **positivo**
- Transferência interna: usar tipo `transfer_out` ou `transfer_in`, valor conforme direção

---

## 8. APIs externas

| API | Arquivo | Rate limit free tier | Observação |
|---|---|---|---|
| Brapi.dev (B3) | `src/lib/external/brapi.ts` | 15 req/min | Usar token do .env |
| CoinGecko | `src/lib/external/coingecko.ts` | 30 req/min | Cache em `CryptoPriceCache` |
| FIPE | `src/lib/external/fipe.ts` | Sem limite publicado | Cachear resposta |

**Regras para APIs externas:**
1. Nunca chamar diretamente do componente React
2. Sempre passar por uma API Route que gerencia cache
3. Tratar timeout e retornar erro amigável se a API externa estiver fora
4. Para CoinGecko: verificar `CryptoPriceCache.updatedAt` antes de buscar — se < 5 min, usar cache

---

## 9. Componentes de UI

- Usar **shadcn/ui** para: botões, inputs, selects, modais, toasts, tabelas, tabs, dropdowns
- Usar **Recharts** para: todos os gráficos — LineChart, BarChart, PieChart, AreaChart
- Não instalar outras bibliotecas de UI ou gráficos sem justificativa explícita
- Ícones: usar **lucide-react** (já incluído com shadcn)
- Cores do sistema definidas em `tailwind.config.ts` como CSS variables — não use hex hardcoded nos componentes

### Padrão de componente de página
```typescript
// src/app/(app)/transactions/page.tsx
export default async function TransactionsPage() {
  // Server Component — busca dados aqui quando possível
  return <TransactionsClient initialData={...} />
}

// src/components/transactions/TransactionsClient.tsx
'use client'
// Client Component — interatividade aqui
```

---

## 10. Tratamento de erros e loading

- Toda chamada de API no cliente: usar `@tanstack/react-query` (useQuery, useMutation)
- Loading state: usar o componente `Skeleton` do shadcn
- Erros: usar o componente `toast` do shadcn para erros de ação, e um bloco de erro inline para erros de carregamento
- Não usar `alert()` ou `console.error` para mostrar erros ao usuário

---

## 11. Transferências internas — regra crítica

Quando uma transação for marcada como `isInternalTransfer = true`:
1. **Não somar ao total de despesas** nas queries de fluxo de caixa
2. **Não somar ao total de receitas** 
3. **Somar ao patrimônio total** apenas pelo saldo da conta destino (evitar dupla contagem)
4. Se as duas pontas forem vinculadas (`linkedTransactionId`), mostrar como par na UI

---

## 12. Cálculo de patrimônio total

```
Patrimônio Total = 
  Σ saldo atual de todas as contas (Account)
  + Σ saldo de SubAccounts (caixinhas)
  + Σ valor de mercado dos investimentos (quantidade × preço atual)
  + Σ valor de renda fixa (FixedIncomeAsset.currentValue)
  + Σ valor de cripto (quantidade × preço atual em BRL)
  + Σ valor atual dos bens (último PatrimonyValue por item)
```

Transferências internas não entram nessa conta (já estão no saldo da conta).

---

## 13. Comandos que você pode precisar durante o desenvolvimento

```bash
# Iniciar
npm run dev

# Banco de dados
npx prisma migrate dev --name <nome-da-migration>
npx prisma generate
npx prisma studio
npx prisma db seed

# Instalar componente shadcn
npx shadcn@latest add <componente>

# Verificar tipos TypeScript
npx tsc --noEmit

# Lint
npm run lint
```

---

## 14. O que NÃO implementar no MVP

- Autenticação OAuth (Google, Apple) — apenas senha local
- Aplicativo mobile ou PWA
- Deploy em nuvem (Vercel, Railway) — apenas localhost
- Notificações push ou por e-mail
- Multi-usuário (múltiplos logins) — apenas perfil local único por MVP
- Modo casal — arquitetura suporta, mas UI de vinculação fica para v2.0
- Cálculo de IR e DARF — registrar operações sim, calcular IR não
- Integração com Open Finance/Banco Central
- Qualquer funcionalidade que exija servidor separado, Redis ou S3

---

## 15. Ordem de implementação recomendada (Sprints)

1. Setup inicial + autenticação local + layout base (sidebar)
2. Cadastro de contas + seed de categorias
3. Parsers Nubank → Inter → PicPay → Wise + tela de importação
4. Histórico de transações (listagem, filtros, edição, categorização)
5. Motor de categorização + regras automáticas
6. Transferências internas (detecção e marcação)
7. Saldo diário + Dashboard principal (KPIs + gráficos)
8. Módulo de Patrimônio Físico + FIPE
9. Carteira de Investimentos (B3) + proventos
10. Carteira de Criptomoedas + importação de exchanges

Não pule etapas — cada sprint depende do anterior.
