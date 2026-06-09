"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const sectionItems = [
  { key: "overview", label: "概览" },
  { key: "applications", label: "应用" },
  { key: "users", label: "用户" },
  { key: "journeys", label: "旅程" },
  { key: "projects", label: "研究项目" },
  { key: "tags", label: "标签" },
];

export function TenantSectionNav({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {sectionItems.map((item) => {
        const href = `/tenants/${tenantSlug}/${item.key}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={item.key}
            href={href}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              active ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
