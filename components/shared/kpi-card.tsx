import { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  accent?: ReactNode;
}) {
  return (
    <Card className="border-[var(--border-light)] shadow-[var(--card-shadow)]">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-start justify-between gap-4 text-xs font-medium text-slate-500">
          <span>{label}</span>
          {accent}
        </div>
        <div className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{value}</div>
        {subtext ? <div className="text-xs text-slate-500">{subtext}</div> : null}
      </CardContent>
    </Card>
  );
}

