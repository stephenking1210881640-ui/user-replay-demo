type DetailLoadingShellProps = {
  title: string;
  subtitle?: string;
  sections?: number;
};

export function DetailLoadingShell({
  title,
  subtitle = "正在准备首屏数据与分析内容。",
  sections = 2,
}: DetailLoadingShellProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="h-10 w-80 max-w-full animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-5 w-[32rem] max-w-full animate-pulse rounded-full bg-slate-100" />
      </div>

      <div className="rounded-3xl border border-[var(--border-light)] bg-white p-5 shadow-[var(--card-shadow)]">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl bg-slate-50 p-4">
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-3 h-5 w-28 animate-pulse rounded-full bg-slate-300" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: sections }).map((_, index) => (
          <div
            key={index}
            className="rounded-3xl border border-[var(--border-light)] bg-white p-5 shadow-[var(--card-shadow)]"
          >
            <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-5 space-y-3">
              <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
