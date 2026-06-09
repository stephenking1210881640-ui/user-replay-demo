import { prisma } from "@/lib/prisma";

export type AiAgentName = "agent1" | "agent2";

export type AiModelRuntimeConfig = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
  source: "tenant_settings" | "env";
};

export type AiModelConfigView = {
  id?: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyMasked: string;
  enabled: boolean;
  source: "tenant_settings" | "env" | "empty";
  updatedAt?: Date;
};

const defaultProvider = "bailian";
const defaultBaseUrl = "https://it-ai.fineres.com/v1";
const defaultModel = "qwen3.6-plus";

export function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function maskApiKey(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}******`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function envConfig(agent: AiAgentName): AiModelRuntimeConfig {
  const provider =
    agent === "agent2"
      ? process.env.AGENT2_PROVIDER || process.env.AGENT1_PROVIDER || defaultProvider
      : process.env.AGENT1_PROVIDER || defaultProvider;
  const model =
    agent === "agent2"
      ? process.env.AGENT2_MODEL || process.env.AGENT1_MODEL || defaultModel
      : process.env.AGENT1_MODEL || defaultModel;
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL || defaultBaseUrl);
  const enabledFlag = agent === "agent2" ? process.env.AGENT2_LLM_ENABLED : process.env.AGENT1_LLM_ENABLED;

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    enabled: enabledFlag !== "0" && Boolean(apiKey),
    source: "env",
  };
}

export async function getAiModelRuntimeConfig(tenantId: string | null | undefined, agent: AiAgentName) {
  if (tenantId) {
    const tenantConfig = await prisma.tenantAiModelConfig.findUnique({
      where: { tenantId },
    });

    if (tenantConfig) {
      return {
        provider: tenantConfig.provider,
        model: tenantConfig.model,
        baseUrl: normalizeBaseUrl(tenantConfig.baseUrl),
        apiKey: tenantConfig.apiKey,
        enabled: tenantConfig.enabled && Boolean(tenantConfig.apiKey.trim()),
        source: "tenant_settings" as const,
      };
    }
  }

  return envConfig(agent);
}

export async function getAiModelConfigView(tenantId: string): Promise<AiModelConfigView> {
  const tenantConfig = await prisma.tenantAiModelConfig.findUnique({
    where: { tenantId },
  });

  if (tenantConfig) {
    return {
      id: tenantConfig.id,
      provider: tenantConfig.provider,
      model: tenantConfig.model,
      baseUrl: normalizeBaseUrl(tenantConfig.baseUrl),
      apiKeyMasked: maskApiKey(tenantConfig.apiKey),
      enabled: tenantConfig.enabled,
      source: "tenant_settings",
      updatedAt: tenantConfig.updatedAt,
    };
  }

  const fallback = envConfig("agent1");

  return {
    provider: fallback.provider,
    model: fallback.model,
    baseUrl: fallback.baseUrl,
    apiKeyMasked: maskApiKey(fallback.apiKey),
    enabled: fallback.enabled,
    source: fallback.apiKey ? "env" : "empty",
  };
}

export function validateAiModelConfigInput(input: {
  provider?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  apiKey?: unknown;
  enabled?: unknown;
}) {
  const provider = typeof input.provider === "string" ? input.provider.trim() : "";
  const baseUrl = typeof input.baseUrl === "string" ? normalizeBaseUrl(input.baseUrl) : "";
  const model = typeof input.model === "string" ? input.model.trim() : "";
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const enabled = Boolean(input.enabled);

  if (!provider) return { ok: false as const, error: "请填写模型平台。" };
  if (!baseUrl) return { ok: false as const, error: "请填写模型中转地址。" };
  if (!model) return { ok: false as const, error: "请填写模型名称。" };
  if (!apiKey) return { ok: false as const, error: "请填写 API Key。" };

  try {
    new URL(baseUrl);
  } catch {
    return { ok: false as const, error: "模型中转地址必须是合法 URL。" };
  }

  return {
    ok: true as const,
    value: {
      provider,
      baseUrl,
      model,
      apiKey,
      enabled,
    },
  };
}
