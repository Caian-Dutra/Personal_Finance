import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountsTab } from "@/components/settings/AccountsTab";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { CategoryRulesTab } from "@/components/settings/CategoryRulesTab";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas contas, categorias e regras de categorização.</p>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="general">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="pt-4">
          <AccountsTab />
        </TabsContent>

        <TabsContent value="categories" className="pt-4">
          <CategoriesTab />
        </TabsContent>

        <TabsContent value="rules" className="pt-4">
          <CategoryRulesTab />
        </TabsContent>

        <TabsContent value="general" className="pt-4">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
            <p className="text-sm text-slate-500">Configurações gerais — Sprint 1</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
