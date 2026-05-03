"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { useState } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transactions": "Transações",
  "/import": "Importação",
  "/investments": "Investimentos",
  "/crypto": "Criptomoedas",
  "/patrimony": "Patrimônio",
  "/settings": "Configurações",
};

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return title;
  }
  return "FinanceOS";
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-[15px] font-semibold text-slate-900 dark:text-white">
        {getPageTitle(pathname)}
      </h1>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400">
          <User className="h-4 w-4" />
          <span>admin</span>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sair"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
}
