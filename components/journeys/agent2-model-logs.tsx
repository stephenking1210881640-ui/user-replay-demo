import { BrainCircuit } from "lucide-react";

import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDateTimeFull } from "@/lib/format";

type Agent2ModelLog = {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  promptVersion: string;
  status: string;
  generationMode: string;
  inputSystemPrompt: string;
  inputUserPrompt: string;
  responseText: string | null;
  parsedOutputJson: unknown;
  errorMessage: string | null;
  latencyMs: number | null;
  tokenUsageJson: unknown;
  createdAt: Date;
  analysis: {
    id: string;
    modelVersion: string;
    outcomeStatus: string;
    generatedAt: Date;
  } | null;
};

function formatJson(value: unknown) {
  if (!value) {
    return "无";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusTone(status: string) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "error" as const;
  return "neutral" as const;
}

export function Agent2ModelLogs({ logs }: { logs: Agent2ModelLog[] }) {
  return (
    <SectionCard
      title="Agent2 模型交互日志"
      description="记录最近 5 次生成 AI 总结时发送给模型的 prompt 和模型返回，便于排查判断依据。"
      action={<StatusPill label={`${logs.length} 条`} tone={logs.length ? "info" : "neutral"} />}
    >
      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
          还没有 Agent2 模型交互日志。点击上方“生成 AI 总结”后，这里会展示本次模型输入和输出。
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log, index) => (
            <details key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <BrainCircuit className="h-4 w-4" />
                      {String(index + 1).padStart(2, "0")}. {log.provider} / {log.model}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTimeFull(log.createdAt)} · {log.promptVersion}
                      {typeof log.latencyMs === "number" ? ` · ${log.latencyMs}ms` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill label={log.status} tone={statusTone(log.status)} />
                    <StatusPill label={log.generationMode} tone={log.generationMode === "llm" ? "success" : "warning"} />
                    {log.analysis ? <StatusPill label={log.analysis.modelVersion} tone="info" /> : null}
                  </div>
                </div>
              </summary>

              <div className="mt-4 grid gap-4">
                {log.errorMessage ? (
                  <div className="rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{log.errorMessage}</div>
                ) : null}

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">System Prompt</div>
                  <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{log.inputSystemPrompt}</pre>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">User Prompt</div>
                  <pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{log.inputUserPrompt}</pre>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">模型原始返回</div>
                    <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{log.responseText ?? "无"}</pre>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">解析后 JSON</div>
                    <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{formatJson(log.parsedOutputJson)}</pre>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  baseUrl: {log.baseUrl ?? "未记录"} · tokenUsage: {formatJson(log.tokenUsageJson)}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
