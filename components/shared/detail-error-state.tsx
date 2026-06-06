"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DetailErrorState({
  title,
  description,
  backHref,
  backLabel,
  reset,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-white p-6 shadow-[var(--card-shadow)]">
      <div className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-500">读取失败</div>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}>
          重新加载
        </button>
        <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
