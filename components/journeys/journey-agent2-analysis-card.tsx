import type { ReactNode } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, Flag, Lightbulb, ShieldCheck } from "lucide-react";

import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDateTimeFull } from "@/lib/format";
import type { JourneyAiAnalysisViewModel } from "@/lib/journey-ai-analysis";

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function outcomeTone(status: JourneyAiAnalysisViewModel["outcome"]["status"]) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "error" as const;
  if (status === "unfinished") return "warning" as const;
  return "neutral" as const;
}

function outcomeLabel(status: JourneyAiAnalysisViewModel["outcome"]["status"]) {
  const labels: Record<JourneyAiAnalysisViewModel["outcome"]["status"], string> = {
    success: "目标已达成",
    failed: "目标被异常阻断",
    unfinished: "目标未完成",
    unknown: "目标不明确",
  };
  return labels[status];
}

function severityTone(severity: string) {
  if (severity === "critical") return "error" as const;
  if (severity === "warning") return "warning" as const;
  return "neutral" as const;
}

function ruleLabel(rule: { label?: string; rule?: string; name?: string; goal?: string; matchReason?: string }) {
  return rule.label ?? rule.goal ?? rule.name ?? rule.rule ?? rule.matchReason ?? "未命名规则";
}

function RuleUsagePanel({ analysis }: { analysis: JourneyAiAnalysisViewModel }) {
  const rules = analysis.agent1Rules;
  if (!rules?.hasProfile) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <ShieldCheck className="h-4 w-4" />
          应用级规则
        </div>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          未找到应用结构理解结果，本次使用通用旅程分析模式，目标和达成判断置信度会下调。
        </p>
      </div>
    );
  }

  const matchedIntents = rules.matchedBusinessIntents.slice(0, 3);
  const successRules = rules.matchedSuccessRules.slice(0, 3);
  const failureRules = rules.matchedFailureRules.slice(0, 3);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <ShieldCheck className="h-4 w-4" />
          已引用应用级规则
        </div>
        <StatusPill label="Agent1 协同" tone="success" />
      </div>
      <p className="mt-2 text-sm leading-6 text-emerald-800">
        {rules.confidenceNote || "本次分析已结合应用结构理解结果进行目标和达成判断。"}
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl bg-white/70 p-3">
          <div className="text-xs font-semibold text-emerald-950">命中业务意图</div>
          <div className="mt-2 space-y-1 text-xs leading-5 text-emerald-800">
            {matchedIntents.length ? matchedIntents.map((rule) => <div key={rule.key}>{ruleLabel(rule)}</div>) : <div>未命中明确业务意图</div>}
          </div>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <div className="text-xs font-semibold text-emerald-950">成功定义</div>
          <div className="mt-2 space-y-1 text-xs leading-5 text-emerald-800">
            {successRules.length ? successRules.map((rule) => <div key={rule.key ?? rule.label}>{ruleLabel(rule)}</div>) : <div>未命中成功定义</div>}
          </div>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <div className="text-xs font-semibold text-emerald-950">失败定义</div>
          <div className="mt-2 space-y-1 text-xs leading-5 text-emerald-800">
            {failureRules.length ? failureRules.map((rule) => <div key={rule.key ?? rule.label}>{ruleLabel(rule)}</div>) : <div>未命中失败定义</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function JourneyAgent2AnalysisCard({
  analysis,
  fallback,
  action,
}: {
  analysis: JourneyAiAnalysisViewModel | null;
  fallback: {
    summary: string;
    goal: string;
    anomaly: string;
  };
  action?: ReactNode;
}) {
  if (!analysis) {
    return (
      <SectionCard title="AI 总结" description="Agent2 分析尚未生成，当前展示旅程基础摘要。" action={action}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-violet-200 bg-[var(--ai-purple-light)] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ai-purple)]">
              一句话总结
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-800">{fallback.summary}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs text-slate-400">目标达成分析</div>
            <p className="mt-2 text-sm leading-7 font-medium text-slate-900">{fallback.goal}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 text-amber-700">
            <div className="text-xs opacity-80">异常行为摘要</div>
            <p className="mt-2 text-sm leading-7 font-medium">{fallback.anomaly}</p>
          </div>
        </div>
      </SectionCard>
    );
  }

  const primaryBlocker = analysis.blockers[0] ?? null;
  const primaryEvidence = analysis.evidence[0] ?? null;

  return (
    <SectionCard
      title="Agent2 单旅程分析"
      description="结构化回答用户目标、过程、结果、阻塞点和证据。"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusPill label={analysis.modelVersion} tone={analysis.modelVersion.includes("llm") ? "success" : "info"} />
          {action}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-violet-200 bg-[var(--ai-purple-light)] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ai-purple)]">
            <BrainCircuit className="h-4 w-4" />
            AI 总结
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-800">{analysis.processSummary}</p>
          <div className="mt-3 text-xs text-slate-500">
            生成时间：{formatDateTimeFull(analysis.generatedAt)}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Flag className="h-4 w-4" />
              旅程目标
            </div>
            <p className="text-sm leading-6 text-slate-700">{analysis.journeyGoal}</p>
            <div className="mt-3 text-xs text-slate-400">置信度 {confidenceLabel(analysis.goalConfidence)}</div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4" />
                目标达成判断
              </div>
              <StatusPill label={outcomeLabel(analysis.outcome.status)} tone={outcomeTone(analysis.outcome.status)} />
            </div>
            <p className="text-sm leading-6 text-slate-700">{analysis.outcome.reason}</p>
            <div className="mt-3 text-xs text-slate-400">置信度 {confidenceLabel(analysis.outcome.confidence)}</div>
          </div>
        </div>

        <RuleUsagePanel analysis={analysis} />

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-900">
              <AlertTriangle className="h-4 w-4" />
              阻塞点
            </div>
            {primaryBlocker ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-rose-900">{primaryBlocker.title}</span>
                  <StatusPill label={primaryBlocker.severity} tone={severityTone(primaryBlocker.severity)} />
                </div>
                <p className="mt-2 text-sm leading-6 text-rose-800">{primaryBlocker.description}</p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-rose-800">未发现明确阻塞点。</p>
            )}
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900">
              <Lightbulb className="h-4 w-4" />
              关键证据
            </div>
            {primaryEvidence ? (
              <div>
                <div className="text-sm font-semibold text-blue-900">{primaryEvidence.title}</div>
                <p className="mt-2 text-sm leading-6 text-blue-800">{primaryEvidence.description}</p>
                <div className="mt-2 text-xs text-blue-700">来源：{primaryEvidence.source}</div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-blue-800">当前旅程暂无明确证据，建议查看完整时间线。</p>
            )}
          </div>
        </div>

        {analysis.productInsights[0] ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">{analysis.productInsights[0].title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{analysis.productInsights[0].description}</p>
            <div className="mt-3 text-sm font-medium text-slate-900">
              建议：{analysis.productInsights[0].recommendation}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
