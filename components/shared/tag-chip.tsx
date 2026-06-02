import { cn } from "@/lib/utils";

export function TagChip({
  label,
  color,
  className,
}: {
  label: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700",
        className
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {label}
    </span>
  );
}

