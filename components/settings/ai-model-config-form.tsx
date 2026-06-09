"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Save, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiModelConfigView } from "@/lib/ai-model-config";

type FormState = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
};

function sourceLabel(source: AiModelConfigView["source"]) {
  if (source === "tenant_settings") return "设置中心配置";
  if (source === "env") return "环境变量回退";
  return "尚未配置";
}

export function AiModelConfigForm({
  tenantSlug,
  initialConfig,
}: {
  tenantSlug: string;
  initialConfig: AiModelConfigView;
}) {
  const [form, setForm] = useState<FormState>({
    provider: initialConfig.provider,
    baseUrl: initialConfig.baseUrl,
    model: initialConfig.model,
    apiKey: "",
    enabled: initialConfig.enabled,
  });
  const [config, setConfig] = useState(initialConfig);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/tenants/${tenantSlug}/ai-model-config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "保存失败，请检查配置。");
        }

        setConfig(data.config);
        setForm((current) => ({ ...current, apiKey: "" }));
        setMessage("AI 模型配置已保存，Agent1 与 Agent2 后续分析会优先使用该配置。");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "保存失败，请稍后重试。");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs text-slate-400">当前配置来源</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{sourceLabel(config.source)}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {config.source === "tenant_settings" ? "当前租户已启用独立模型配置。" : "未保存租户配置时，会继续读取服务端环境变量。"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs text-slate-400">当前模型</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{config.model || "未配置"}</div>
          <p className="mt-1 text-xs text-slate-500">{config.provider || "未配置平台"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs text-slate-400">密钥状态</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {config.apiKeyMasked || "未保存 API Key"}
          </div>
          <p className="mt-1 text-xs text-slate-500">页面只展示脱敏值，保存时不会回传完整密钥。</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">模型平台</span>
          <Input
            value={form.provider}
            onChange={(event) => updateField("provider", event.target.value)}
            placeholder="例如：bailian"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">模型名称</span>
          <Input
            value={form.model}
            onChange={(event) => updateField("model", event.target.value)}
            placeholder="例如：qwen3.6-plus"
          />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">模型中转地址</span>
          <Input
            value={form.baseUrl}
            onChange={(event) => updateField("baseUrl", event.target.value)}
            placeholder="例如：https://it-ai.fineres.com/v1"
          />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">API Key</span>
          <Input
            type="password"
            value={form.apiKey}
            onChange={(event) => updateField("apiKey", event.target.value)}
            placeholder={config.apiKeyMasked ? "留空则沿用已保存密钥" : "请输入 API Key"}
            autoComplete="off"
          />
          <p className="text-xs leading-5 text-slate-500">
            保存后 Agent1 应用结构理解和 Agent2 单旅程分析都会使用这组模型配置。
          </p>
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => updateField("enabled", event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">启用租户模型配置</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            关闭后会停用该租户保存的模型配置，Agent 分析会进入规则回退或环境变量回退策略。
          </span>
        </span>
      </label>

      {message ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存模型配置
        </Button>
      </div>
    </div>
  );
}
