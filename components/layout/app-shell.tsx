"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Bell,
  Building2,
  FolderKanban,
  LayoutGrid,
  Search,
  Settings,
  Tags,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

type TenantContext = {
  slug: string;
  status: "ACTIVE" | "TRIAL" | "RISK";
  plan: "STARTER" | "GROWTH" | "ENTERPRISE";
};

const tenantStatusLabelMap: Record<TenantContext["status"], string> = {
  ACTIVE: "正常",
  TRIAL: "试用",
  RISK: "风险",
};

const tenantPlanLabelMap: Record<TenantContext["plan"], string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  ENTERPRISE: "Enterprise",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tenantSlug = pathname.startsWith("/tenants/") ? pathname.split("/")[2] ?? "" : "";
  const tenantPrefix = tenantSlug ? `/tenants/${tenantSlug}` : "";
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);

  useEffect(() => {
    if (!tenantSlug) {
      setTenantContext(null);
      return;
    }

    let ignored = false;

    fetch(`/api/tenants/${tenantSlug}/context`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!ignored) {
          setTenantContext(data?.tenant ?? null);
        }
      })
      .catch(() => {
        if (!ignored) {
          setTenantContext(null);
        }
      });

    return () => {
      ignored = true;
    };
  }, [tenantSlug]);

  const navItems = tenantSlug
    ? [
        { href: "/tenants", label: "企业租户", icon: Building2 },
        { href: `${tenantPrefix}/overview`, label: "租户概览", icon: LayoutGrid },
        { href: `${tenantPrefix}/applications`, label: "应用列表", icon: LayoutGrid },
        { href: `${tenantPrefix}/users`, label: "用户管理", icon: Users },
        { href: `${tenantPrefix}/tags`, label: "标签管理", icon: Tags },
        { href: `${tenantPrefix}/projects`, label: "研究项目", icon: FolderKanban },
        { href: `${tenantPrefix}/journeys`, label: "用户旅程", icon: Search },
        { href: "/settings", label: "设置中心", icon: Settings, disabled: true },
      ]
    : [
        { href: "/tenants", label: "企业租户", icon: Building2 },
        { href: "/settings", label: "设置中心", icon: Settings, disabled: true },
      ];

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[var(--bg-sidebar)] text-slate-300 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div className="h-6 w-6 rounded-md bg-[linear-gradient(135deg,#2563eb,#8b5cf6)]" />
          <div>
            <div className="text-sm font-semibold tracking-wide text-white">InsightFlow</div>
            <div className="text-xs text-slate-400">用户回放平台</div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            {navItems.map(({ href, label, icon: Icon, disabled }) => {
              const active = pathname === href || (href !== "/tenants" && pathname.startsWith(href));

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
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/5 px-3 py-4">
          {tenantSlug ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs text-slate-500">当前租户状态</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                    tenantContext?.status === "RISK"
                      ? "bg-amber-400/10 text-amber-200"
                      : tenantContext?.status === "TRIAL"
                        ? "bg-sky-400/10 text-sky-200"
                        : "bg-emerald-400/10 text-emerald-200",
                  )}
                >
                  {tenantContext ? tenantStatusLabelMap[tenantContext.status] : "加载中"}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                  {tenantContext ? tenantPlanLabelMap[tenantContext.plan] : "套餐"}
                </span>
              </div>
              <Link
                href="/tenants"
                className="mt-3 flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeftRight className="h-4 w-4" />
                切换租户
              </Link>
            </div>
          ) : (
            <Link
              href="/tenants"
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <Building2 className="h-4 w-4" />
              进入企业租户
            </Link>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border-light)] bg-white px-6">
          <div className="rounded-lg border border-[var(--border-light)] bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            {tenantSlug ? "租户工作台" : "平台空间 / 多租户管理"}
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
