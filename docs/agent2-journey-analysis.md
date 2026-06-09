# Agent2：单旅程整理与分析

Agent2 用于对单条已聚合的用户旅程做结构化解释，回答“用户想做什么、过程如何、是否达成、哪里被阻断、有哪些证据、产品上该怎么处理”。

当前版本采用“规则分析 + LLM 增强 + Agent1 应用规则协同”的混合方式：

- `agent2-rules-v1`：稳定兜底，确保详情页首屏始终可生成结构化结果。
- `agent2-llm-v1`：在模型配置可用时，对单条旅程进行业务语言提炼。
- `agent2-llm-fallback-v1`：模型调用失败或未启用时，保留规则结果并写入回退日志。

所有最终展示给业务用户的总结、目标、阻塞点、洞察都会进行业务语言清洗，避免直接展示 HTTP、SDK、DOM、track、region、CTA、前端等技术词。

## 输入

Agent2 以单条 `Journey` 为核心输入，并读取以下上下文：

- `tenantId`
- `applicationId`
- `journeyId`
- 旅程基础数据：标题、页面、状态、时长、页面数、关键动作数、请求数
- 用户信息：`User`、用户标签
- 时间线：`JourneyEvent`
- 请求与错误事件：`JourneyEvent.type = REQUEST / ANOMALY`
- 证据：`Evidence`
- 原始浏览器事件：`BrowserEvent`，用于后续扩展
- 最新 Agent1 应用结构结果：`ApplicationAiProfile.journeysJson`、`successRulesJson`、`failureRulesJson`、`sdkRecommendationsJson`、`interactiveElementsJson`

## 输出

Agent2 输出固定结构，供详情页、列表摘要和后续研究项目分析复用：

```ts
type Agent2JourneyAnalysisOutput = {
  journeyGoal: string;
  goalConfidence: number;
  processSummary: string;
  keyStages: Array<{
    key: string;
    title: string;
    description: string;
    offsetMs: number;
    eventIds: string[];
    evidenceIds: string[];
    confidence: number;
  }>;
  outcome: {
    status: "success" | "failed" | "unfinished" | "unknown";
    reason: string;
    confidence: number;
  };
  blockers: Array<{
    key: string;
    title: string;
    description: string;
    severity: "info" | "warning" | "critical";
    eventIds: string[];
    evidenceIds: string[];
    offsetMs?: number;
  }>;
  anomalies: Array<{
    key: string;
    title: string;
    description: string;
    severity: "info" | "warning" | "critical";
    eventIds: string[];
    evidenceIds: string[];
    offsetMs?: number;
  }>;
  evidence: Array<{
    id: string;
    type: "event" | "evidence" | "request" | "agent1_rule";
    title: string;
    description: string;
    source: string;
    eventId?: string;
    evidenceId?: string;
    offsetMs?: number;
  }>;
  productInsights: Array<{
    key: string;
    title: string;
    description: string;
    impact: "low" | "medium" | "high";
    recommendation: string;
  }>;
  agent1Rules?: {
    hasProfile: boolean;
    profileId?: string;
    profileGeneratedAt?: string;
    appPurpose?: string;
    businessJourneys: unknown[];
    successRules: unknown[];
    failureRules: unknown[];
    suggestedBusinessIntents: unknown[];
    matchedBusinessJourneys: unknown[];
    matchedSuccessRules: unknown[];
    matchedFailureRules: unknown[];
    matchedBusinessIntents: unknown[];
    confidenceNote: string;
  };
};
```

## 存储

新增 Prisma 模型 `JourneyAiAnalysis`，数据库表名：

```text
journey_ai_analyses
```

关键字段：

- `tenantId`
- `applicationId`
- `journeyId`
- `goal`
- `goalConfidence`
- `processSummary`
- `outcomeStatus`
- `outcomeReason`
- `outcomeConfidence`
- `keyStagesJson`
- `blockersJson`
- `anomaliesJson`
- `evidenceJson`
- `insightsJson`
- `agent1RulesJson`
- `generatedAt`
- `modelVersion`

当前没有做唯一约束，允许后续重复分析并保留历史版本。页面默认读取 `generatedAt desc` 的最新结果。

## 分析规则

第一版规则重点保证稳定性和可解释性：

- 旅程目标优先从 `businessActionType`、`businessAction`、`businessIntent`、`targetLabel`、页面标题中推断。
- `COMPLETED` 映射为 `success`。
- `FAILED` 映射为 `failed`。
- `ABANDONED` 映射为 `unfinished`。
- `BROWSING` 映射为 `unknown`，表示只有浏览行为，无法确认明确业务目标。
- `HTTP >= 400` 的请求会生成失败请求阻塞点。
- `durationMs >= 1800` 的请求会生成长耗时阻塞点。
- `JourneyEvent.isAnomaly`、`ANOMALY`、错误反馈文本会生成异常。
- `Evidence` 会被转成可引用证据，并保留 `eventId` / `evidenceId`。
- 如果存在 Agent1 最新结果，会读取应用级核心业务旅程、成功定义、失败定义和建议业务意图，并保存命中情况到 `agent1RulesJson`。
- 如果不存在 Agent1 最新结果，Agent2 使用通用行为模式分析，并在 `agent1RulesJson.confidenceNote` 和产品洞察中标注“缺少应用级业务规则”。

## Agent1 联动

Agent1 负责理解应用结构，输出应用级：

- 核心业务旅程候选
- 成功定义
- 失败定义
- 建议业务意图
- 关键业务区域和操作建议

Agent2 在分析单条旅程时读取同一应用下最新 `ApplicationAiProfile`，通过 `buildApplicationRuleContext` 聚合为应用级规则上下文：

- `businessJourneys`：来自 Agent1 的核心业务旅程候选。
- `successRules`：来自 Agent1 的应用级成功定义。
- `failureRules`：来自 Agent1 的应用级失败定义。
- `suggestedBusinessIntents`：来自核心业务旅程、建议业务动作和关键交互资源。
- `matchedBusinessJourneys`：当前旅程命中的业务旅程。
- `matchedSuccessRules`：当前旅程命中的成功定义。
- `matchedFailureRules`：当前旅程命中的失败定义。
- `matchedBusinessIntents`：当前旅程命中的业务意图。

协同逻辑：

- 推断旅程目标时，优先使用命中的业务意图，其次使用命中的核心业务旅程，再回退到通用行为规则。
- 判断目标达成时，优先参考命中的失败定义和成功定义，再结合旅程状态、阻塞点和证据。
- 如果命中失败定义且旅程未明确成功，会倾向判断为 `failed`。
- 如果命中成功定义且没有关键阻塞，会倾向判断为 `success`。
- 如果没有 Agent1 profile，Agent2 仍会分析，但目标置信度和达成置信度会下调，并提示先执行“AI 理解应用”。

当前匹配方式是轻量文本语义命中，目标是先打通结构。后续可以改为：

- 规则 DSL 精准匹配
- LLM 判断规则命中
- Agent1 业务区域与 JourneyEvent 业务区域的强关联分析

## LLM 增强与日志

点击旅程详情页中的“生成 AI 总结”会调用：

```text
POST /api/tenants/[tenantId]/journeys/[journeyId]/ai-analysis
```

服务端执行流程：

1. 读取租户、旅程、用户、时间线、证据、原始事件。
2. 读取该应用最新 Agent1 profile。
3. 先生成规则版 Agent2 结果。
4. 如果模型配置可用，将旅程快照、Agent1 规则上下文和规则版分析一起提交给模型。
5. 模型返回结构化 JSON 后进行 schema 校验和业务语言清洗。
6. 保存到 `journey_ai_analyses`。
7. 保存模型输入、输出和解析结果到 `agent2_model_interaction_logs`。

模型提示词明确要求：

- 优先引用 Agent1 的核心业务旅程、成功定义和失败定义。
- 不编造不存在的事件或证据。
- 所有用户可见字段使用业务语言。
- 不输出 HTTP、接口、SDK、track、DOM、region、CTA、前端、selector、token、appKey、网络、代码等技术词。

## 页面接入

已接入：

- `/tenants/[tenantId]/journeys/[journeyId]`
  - 服务端优先读取最新 Agent2 分析。
  - 没有分析时懒生成并落库。
  - 首屏展示 AI 总结、旅程目标、目标达成判断、关键阶段、阻塞点、关键证据。
  - AI 总结卡展示是否引用应用级规则，并列出命中的业务意图、成功定义和失败定义。
  - 页面底部展示 Agent2 每次模型交互日志，包括输入提示词、返回文本和解析结果。
- `/tenants/[tenantId]/journeys`
  - 如果旅程已有 Agent2 分析，列表页 “AI 摘要” 优先使用 Agent2 一句话摘要。
  - 没有分析时继续使用 `Journey.aiSummaryShort`。
- `/tenants/[tenantId]/projects/[projectId]`
  - 已纳入旅程和候选旅程的摘要读取最新 Agent2 摘要。
- `/tenants/[tenantId]/overview`、`/users`、`/users/[userId]`
  - 最近旅程摘要也会优先展示已有 Agent2 结果。

## 验证方式

1. 同步数据库：

```bash
npm run db:push
```

2. 构建验证：

```bash
npm run build
```

3. 触发单条旅程分析：

```bash
npx tsx -e 'import { prisma } from "./lib/prisma"; import { ensureJourneyAiAnalysis, toJourneyAiAnalysisViewModel } from "./lib/journey-ai-analysis"; (async () => { const journey = await prisma.journey.findFirst({ orderBy: { startedAt: "desc" }, select: { id: true, journeyCode: true } }); if (!journey) return; const analysis = await ensureJourneyAiAnalysis(journey.id, { regenerate: true }); console.log(journey.journeyCode, toJourneyAiAnalysisViewModel(analysis)); })().finally(() => prisma.$disconnect());'
```

4. 页面验证：

- 打开 `/tenants/test1/journeys`，确认列表 “AI 摘要” 不为空。
- 打开任意 `/tenants/test1/journeys/[journeyId]`，确认首屏出现 “Agent2 单旅程分析”。
- 打开 `/tenants/test1/projects/[projectId]`，确认已纳入旅程摘要可正常展示。
