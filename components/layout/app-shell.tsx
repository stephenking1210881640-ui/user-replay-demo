"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FolderKanban,
  LayoutGrid,
  Search,
  Settings,
  Tags,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/integration", label: "应用概览", icon: LayoutGrid },
  { href: "/users", label: "用户管理", icon: Users },
  { href: "/tags", label: "标签管理", icon: Tags, disabled: true },
  { href: "/projects", label: "研究项目", icon: FolderKanban },
  { href: "/journeys", label: "用户旅程", icon: Search },
  { href: "/settings", label: "设置中心", icon: Settings, disabled: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-slate-900">
      <aside className="hidden w-60 shrink-0 flex-col bg-[var(--bg-sidebar)] text-slate-300 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div className="h-6 w-6 rounded-md bg-[linear-gradient(135deg,#2563eb,#8b5cf6)]" />
          <div>
            <div className="text-sm font-semibold tracking-wide text-white">InsightFlow</div>
            <div className="text-xs text-slate-400">用户回放平台</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map(({ href, label, icon: Icon, disabled }) => {
            const active =
              pathname === href ||
              (href.startsWith("/projects") && pathname.startsWith("/projects")) ||
              (href.startsWith("/journeys") && pathname.startsWith("/journeys")) ||
              (href.startsWith("/users") && pathname.startsWith("/users"));

            return (
              <Link
                key={href}
                href={disabled ? "#" : href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[var(--primary)] text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                  disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-slate-300"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border-light)] bg-white px-6">
          <div className="rounded-lg border border-[var(--border-light)] bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            B 端商家后台空间
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-lg border border-[var(--border-light)] bg-slate-50 px-3 py-2 md:flex">
              <Search className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-400">搜索用户 ID、旅程或页面路径...</span>
            </div>
            <Bell className="h-5 w-5 text-slate-500" />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-white">
              W
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
