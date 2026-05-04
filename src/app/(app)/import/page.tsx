import { ImportClient } from "@/components/import/ImportClient";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Importar Extrato</h1>
        <p className="text-sm text-slate-500 mt-1">
          Selecione o banco, a conta e envie o arquivo CSV do seu extrato.
        </p>
      </div>
      <ImportClient />
    </div>
  );
}
