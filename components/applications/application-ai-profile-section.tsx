import { BrainCircuit, CheckCircle2, Code2, MousePointerClick, Route, ShieldAlert } from "lucide-react";

import { RunAgent1Button } from "@/components/applications/run-agent1-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDateTimeFull } from "@/lib/format";

type AiProfileLike = {
  id: string;
  sourceUrl: string;
  appPurpose: string;
  appSummary: string;
  pageMapJson: unknown;
  regionsJson: unknown;
  interactiveElementsJson: unknown;
  journeysJson: unknown;
  successRulesJson: unknown;
  failureRulesJson: unknown;
  sdkRecommendationsJson: unknown;
  confidenceNotesJson: unknown;
  modelMetadataJson?: unknown;
  generatedAt: Date;
  version: string;
  provider?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  generationMode?: string;
  fallbackUsed?: boolean;
};

type PageMapItem = {
  url?: string;
  path?: string;
  title?: string;
  purpose?: string;
  keyRegions?: string[];
  keyInteractions?: string[];
};

type RegionItem = {
  key?: string;
  name?: string;
  pages?: string[];
  description?: string;
  suggestedDataAttribute?: string;
  confidence?: number;
};

type JourneyItem = {
  key?: string;
  name?: string;
  goal?: string;
  keySteps?: string[];
  successSignals?: string[];
  failureSignals?: string[];
  recommendedTrackEvents?: string[];
};

type SignalItem = {
  key?: string;
  label?: string;
  ruleType?: string;
  rule?: string;
  severity?: string;
  confidence?: number;
};

type SdkRecommendationItem = {
  eventName?: string;
  trigger?: string;
  regionKey?: string;
  businessMeaning?: string;
  suggestedPayload?: Record<string, string>;
  suggestedDataAttributes?: Record<string, string>;
  priority?: string;
};

type ConfidenceNoteItem = {
  topic?: string;
  note?: string;
  confidence?: number;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function confidenceLabel(value?: number) {
  if (typeof value !== "number") return "待确认";
  return `${Math.round(value * 100)}%`;
}

function generationModeLabel(mode?: string, fallbackUsed?: boolean) {
  if (fallbackUsed || mode === "llm_fallback") return "模型回退";
  if (mode === "llm") return "模型增强";
  return "规则分析";
}

function generationModeTone(mode?: string, fallbackUsed?: boolean) {
  if (fallbackUsed || mode === "llm_fallback") return "warning" as const;
  if (mode === "llm") return "success" as const;
  return "neutral" as const;
}

function defaultWebsiteUrl(host: string) {
  return host.startsWith("http://") || host.startsWith("https://") ? host : `https://${host}`;
}

const productionIngestEndpoint = "https://user-replay-demo.vercel.app/api/ingest/browser-events";

function quote(value: string) {
  return JSON.stringify(value);
}

function buildSdkInitSnippet({
  appKey,
  ingestToken,
  applicationHost,
}: {
  appKey?: string;
  ingestToken?: string | null;
  applicationHost: string;
}) {
  return `import { createJourneyCollector } from "@user-replay/browser-collector";

export const collector = createJourneyCollector({
  appKey: ${quote(appKey ?? "替换为当前应用 App Key")},
  ingestToken: ${quote(ingestToken ?? "替换为当前应用 Ingest Token")},
  endpoint: ${quote(productionIngestEndpoint)},
  host: ${quote(applicationHost)},
  redactKeys: ["email", "phone", "password", "token", "authorization"]
});

export function identifyReplayUser(userId: string, traits?: Record<string, string>) {
  collector.identify(userId, traits);
}
`;
}

function buildPayloadSnippet(item: SdkRecommendationItem) {
  const payload = {
    region: item.regionKey ?? "content_area",
    source: "agent1_sdk_assistant",
    ...(item.suggestedPayload ?? {}),
  };

  return JSON.stringify(payload, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `      ${line}`))
    .join("\n");
}

function buildTrackSnippet(item: SdkRecommendationItem) {
  const eventName = item.eventName ?? "business_action_clicked";
  return `collector.track(${quote(eventName)}, ${buildPayloadSnippet(item)});`;
}

function buildReactInstrumentationSnippet(items: SdkRecommendationItem[]) {
  const enabledItems = items.filter((item) => item.eventName).slice(0, 4);
  if (!enabledItems.length) {
    return `// Agent1 暂未生成可用的 SDK track 建议。
// 请先点击“AI 理解应用”，或在业务代码中手动补充 collector.track(...)。`;
  }

  return `import { collector } from "@/lib/userReplay";

${enabledItems
  .map((item, index) => {
    const eventName = item.eventName ?? "business_action_clicked";
    const regionKey = item.regionKey ?? "content_area";
    const businessMeaning = item.businessMeaning ?? "触发关键业务动作";
    return `// ${index + 1}. ${item.trigger ?? businessMeaning}
<button
  data-ur-region=${quote(regionKey)}
  data-ur-action=${quote(eventName)}
  data-ur-business-action=${quote(businessMeaning)}
  onClick={() => {
    ${buildTrackSnippet(item)}

    // TODO: 保留原有业务逻辑，例如 addToCart(product) / checkout()
  }}
>
  ${eventName}
</button>`;
  })
  .join("\n\n")}`;
}

export function ApplicationAiProfileSection({
  tenantSlug,
  applicationId,
  applicationHost,
  appKey,
  ingestToken,
  profile,
  compact = false,
}: {
  tenantSlug: string;
  applicationId: string;
  applicationHost: string;
  appKey?: string;
  ingestToken?: string | null;
  profile?: AiProfileLike | null;
  compact?: boolean;
}) {
  const pageMap = asArray<PageMapItem>(profile?.pageMapJson);
  const regions = asArray<RegionItem>(profile?.regionsJson);
  const journeys = asArray<JourneyItem>(profile?.journeysJson);
  const successRules = asArray<SignalItem>(profile?.successRulesJson);
  const failureRules = asArray<SignalItem>(profile?.failureRulesJson);
  const sdkRecommendations = asArray<SdkRecommendationItem>(profile?.sdkRecommendationsJson);
  const confidenceNotes = asArray<ConfidenceNoteItem>(profile?.confidenceNotesJson);
  const modelMetadata = asRecord(profile?.modelMetadataJson);
  const generationMode = profile?.generationMode ?? (typeof modelMetadata.generationMode === "string" ? modelMetadata.generationMode : undefined);
  const fallbackUsed = profile?.fallbackUsed ?? Boolean(modelMetadata.fallbackUsed);
  const provider = profile?.provider ?? (typeof modelMetadata.provider === "string" ? modelMetadata.provider : null);
  const model = profile?.model ?? (typeof modelMetadata.model === "string" ? modelMetadata.model : null);
  const latencyMs = typeof modelMetadata.latencyMs === "number" ? modelMetadata.latencyMs : null;
  const sdkInitSnippet = buildSdkInitSnippet({ appKey, ingestToken, applicationHost });
  const reactInstrumentationSnippet = buildReactInstrumentationSnippet(sdkRecommendations);

  return (
    <SectionCard
      title="Agent1 应用结构理解"
      description="分析目标应用页面结构，沉淀 region、业务旅程、成功/失败规则和 SDK 埋点建议。"
      action={<RunAgent1Button tenantSlug={tenantSlug} applicationId={applicationId} defaultWebsiteUrl={defaultWebsiteUrl(applicationHost)} />}
    >
      {profile ? (
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <BrainCircuit className="h-4 w-4" />
                应用理解
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{profile.appPurpose}</p>
              <div className="mt-3 text-xs leading-5 text-slate-500">
                来源：<span className="font-mono">{profile.sourceUrl}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {profile.version} · {formatDateTimeFull(profile.generatedAt)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill label={generationModeLabel(generationMode, fallbackUsed)} tone={generationModeTone(generationMode, fallbackUsed)} />
                {model ? <span className="text-xs text-slate-500">{provider ?? "model"} / {model}</span> : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">页面 / Region</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{pageMap.length} / {regions.length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">交互 / Track 建议</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{asArray(profile.interactiveElementsJson).length} / {sdkRecommendations.length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">生成方式</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{generationModeLabel(generationMode, fallbackUsed)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">模型耗时</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : "未记录"}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Route className="h-4 w-4" />
                页面地图
              </div>
              <div className="space-y-3">
                {pageMap.slice(0, compact ? 3 : 6).map((page, index) => (
                  <div key={`${page.url}-${index}`} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-900">{page.title ?? page.path ?? "未命名页面"}</div>
                    <div className="mt-1 break-all text-xs text-slate-500">{page.path ?? page.url}</div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{page.purpose}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-900">建议 Region</div>
              <div className="grid gap-2">
                {regions.slice(0, compact ? 5 : 10).map((region) => (
                  <div key={region.key} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{region.name ?? region.key}</div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{region.description}</p>
                      </div>
                      <StatusPill label={confidenceLabel(region.confidence)} tone={(region.confidence ?? 0) >= 0.75 ? "success" : "warning"} />
                    </div>
                    <div className="mt-2 rounded-lg bg-white px-2 py-1 font-mono text-xs text-slate-500">{region.suggestedDataAttribute}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!compact ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">核心业务旅程</div>
                <div className="space-y-3">
                  {journeys.map((journey) => (
                    <div key={journey.key} className="rounded-xl bg-slate-50 p-3">
                      <div className="font-semibold text-slate-900">{journey.name}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{journey.goal}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(journey.recommendedTrackEvents ?? []).map((eventName) => (
                          <span key={eventName} className="rounded-full bg-white px-2 py-1 font-mono text-[11px] text-slate-500">{eventName}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MousePointerClick className="h-4 w-4" />
                  SDK track 建议
                </div>
                <div className="space-y-2">
                  {sdkRecommendations.slice(0, 12).map((item) => (
                    <div key={item.eventName} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-sm font-semibold text-slate-900">{item.eventName}</div>
                        <StatusPill label={item.priority ?? "medium"} tone={item.priority === "high" ? "error" : "info"} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.trigger} · {item.businessMeaning}</p>
                      <div className="mt-2 text-xs text-slate-500">
                        region：<span className="font-mono">{item.regionKey}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {!compact ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Code2 className="h-4 w-4" />
                SDK 代码生成
              </div>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                以下代码由已保存的 Agent1 页面结构结果生成，不会再次调用模型。先接入初始化文件，再按建议给关键区域补充 data-ur-* 与 collector.track。
              </p>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="overflow-hidden rounded-2xl bg-slate-900">
                  <div className="border-b border-white/10 px-4 py-3 text-xs text-slate-400">src/lib/userReplay.ts</div>
                  <pre className="max-h-[420px] overflow-auto px-4 py-4 text-xs leading-6 text-slate-100">{sdkInitSnippet}</pre>
                </div>
                <div className="overflow-hidden rounded-2xl bg-slate-900">
                  <div className="border-b border-white/10 px-4 py-3 text-xs text-slate-400">React 关键交互接入示例</div>
                  <pre className="max-h-[420px] overflow-auto px-4 py-4 text-xs leading-6 text-slate-100">{reactInstrumentationSnippet}</pre>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-900">1. 初始化 SDK</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">把初始化文件放到目标应用公共位置，并在入口文件中导入。</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-900">2. 标记关键区域</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">优先给商品、购物车、表单等核心区域补 data-ur-region。</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-900">3. 校验回传</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">访问目标应用触发事件后，在应用详情页或旅程列表查看是否收到 track 和 region。</p>
                </div>
              </div>
            </div>
          ) : null}

          {!compact ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <CheckCircle2 className="h-4 w-4" />
                  成功规则建议
                </div>
                <div className="space-y-2">
                  {successRules.slice(0, 6).map((rule) => (
                    <div key={rule.key ?? rule.label} className="text-xs leading-5 text-emerald-900">{rule.label ?? rule.rule}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-950">
                  <ShieldAlert className="h-4 w-4" />
                  失败规则建议
                </div>
                <div className="space-y-2">
                  {failureRules.slice(0, 6).map((rule) => (
                    <div key={rule.key ?? rule.label} className="text-xs leading-5 text-rose-900">{rule.label ?? rule.rule}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">置信度说明</div>
                <div className="space-y-2">
                  {confidenceNotes.map((note) => (
                    <div key={note.topic} className="text-xs leading-5 text-slate-600">
                      <span className="font-semibold text-slate-900">{note.topic}：</span>{note.note}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <div className="font-semibold text-slate-900">尚未生成应用结构理解结果</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            点击“AI 理解应用”后，Agent1 会抓取目标网站并生成页面地图、region、关键交互、成功/失败规则和 SDK track 建议。
          </p>
        </div>
      )}
    </SectionCard>
  );
}
