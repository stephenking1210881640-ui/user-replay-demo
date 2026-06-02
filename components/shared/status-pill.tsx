import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "error" | "info" | "neutral";

const toneClassMap: Record<Tone, string> = {
  success: "border-emerald-200 bg-emerald-100 text-emerald-700",
  warning: "border-amber-200 bg-amber-100 text-amber-700",
  error: "border-rose-200 bg-rose-100 text-rose-700",
  info: "border-violet-200 bg-violet-100 text-violet-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", toneClassMap[tone])}>
      {label}
    </Badge>
  );
}

