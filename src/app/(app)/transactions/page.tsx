import { TransactionsClient } from "@/components/transactions/TransactionsClient";

export default function TransactionsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Transações</h1>
        <p className="text-sm text-muted-foreground">Histórico de movimentações importadas</p>
      </div>
      <TransactionsClient />
    </div>
  );
}
