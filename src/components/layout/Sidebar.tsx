"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  TrendingUp,
  Bitcoin,
  Home,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/import", label: "Importação", icon: Upload },
  { href: "/investments", label: "Investimentos", icon: TrendingUp },
  { href: "/crypto", label: "Cripto", icon: Bitcoin },
  { href: "/patrimony", label: "Patrimônio", icon: Home },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[220px] flex-none flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F1F33]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-blue-500">
          <Wallet className="h-4 w-4 text-white" />
        </div>
        <span className="text-[15px] font-semibold text-slate-900 dark:text-white tracking-tight">
          FinanceOS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-none",
                      isActive
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-400 dark:text-slate-500"
                    )}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="text-[11px] text-slate-400 dark:text-slate-600">v1.0 · local</p>
      </div>
    </aside>
  );
}
