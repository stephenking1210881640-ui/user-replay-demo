# Agent1：应用结构理解与埋点策略

Agent1 用于在应用接入阶段理解目标网站结构，并输出 region、关键交互、核心业务旅程、成功/失败规则和 SDK track 建议。

## 输入

触发入口：

```text
POST /api/tenants/[tenantId]/applications/[appId]/ai-profile
```

请求体：

```json
{
  "websiteUrl": "https://test-react-shopping-cart-obtj.vercel.app",
  "businessHint": "这是一个电商购物车测试应用，核心目标是从商品浏览到结算。"
}
```

说明：

- `tenantId` 为租户 slug。
- `appId` 为当前租户下的应用 ID。
- `websiteUrl` 可省略，省略时使用应用 `host`。
- `businessHint` 可选，用于提高业务目标判断准确度。

## 执行方式

当前采用“服务端抓取结构 + LLM 提炼 + 规则回退”的方式实现，不引入 Puppeteer / Playwright。

当前策略：

- 仅抓取 http / https 页面。
- 从输入地址开始，同源递归探索少量关键链接。
- 最多抓取 4 个页面。
- 单页面抓取超时 8 秒。
- 分析 title、description、heading、section、nav、form、button、link、input 等结构。
- 先生成结构化 `crawlSnapshot`。
- 默认调用 OpenAI-compatible 模型接口进行提炼总结。
- 模型失败、超时或未配置时，自动回退 deterministic heuristics 结果。

后续可替换为真实浏览器抓取或 AI 视觉/DOM 解构，但输出结构保持稳定。

## 模型配置

本地环境变量建议放在 `.env.local`，线上 Vercel 需要配置同名变量：

```text
OPENAI_API_KEY=你的模型服务密钥
OPENAI_BASE_URL=https://it-ai.fineres.com/v1
AGENT1_LLM_ENABLED=1
AGENT1_PROVIDER=bailian
AGENT1_MODEL=qwen3.6-plus
```

说明：

- `OPENAI_BASE_URL` 使用 OpenAI-compatible 中转地址。
- `AGENT1_LLM_ENABLED=1` 时默认调用模型。
- 如果模型接口失败或返回 JSON 不合法，系统会保存规则回退结果，并在页面显示“模型回退”。

## 输出

Agent1 输出结构包括：

- `appSummary`：应用用途、目标用户、价值判断和证据。
- `pageMap`：页面 URL、path、标题、页面目的、关键 region 和关键交互。
- `regions`：建议 region、识别来源、置信度、建议 `data-ur-region`。
- `interactiveElements`：按钮、链接、表单、输入框等关键交互资源。
- `businessJourneys`：核心业务旅程、目标、关键步骤、成功/失败信号、建议 track 事件。
- `successSignals`：成功规则建议。
- `failureSignals`：失败规则建议。
- `sdkRecommendations`：建议补充的 Browser Collector SDK track 事件和 `data-ur-*` 标记。
- `confidenceNotes`：抓取范围、region 判断和埋点建议的置信度说明。
- `crawlMetadata`：抓取元数据、版本和跳过 URL。

## 存储

结果保存在 Prisma 模型 `ApplicationAiProfile`，数据库表名：

```text
application_ai_profiles
```

关键字段：

- `tenantId`
- `applicationId`
- `sourceUrl`
- `businessHint`
- `appPurpose`
- `appSummary`
- `pageMapJson`
- `regionsJson`
- `interactiveElementsJson`
- `journeysJson`
- `successRulesJson`
- `failureRulesJson`
- `sdkRecommendationsJson`
- `confidenceNotesJson`
- `crawlMetadataJson`
- `inputSnapshotJson`
- `modelOutputJson`
- `modelMetadataJson`
- `provider`
- `model`
- `promptVersion`
- `generationMode`
- `fallbackUsed`
- `generatedAt`
- `version`

其中：

- `inputSnapshotJson` 保存发送给模型前的结构化页面快照。
- `modelOutputJson` 保存模型原始 JSON 输出，便于审计和复盘。
- `modelMetadataJson` 保存模型、耗时、token、fallback 等元信息。
- `generationMode` 取值为 `heuristic`、`llm` 或 `llm_fallback`。

## 模型交互日志

每次 Agent1 实际调用模型时，都会额外写入 Prisma 模型 `Agent1ModelInteractionLog`，数据库表名：

```text
agent1_model_interaction_logs
```

该日志用于排查模型理解和结构化输出问题，不保存 API Key。关键字段：

- `tenantId`
- `applicationId`
- `profileId`
- `provider`
- `model`
- `baseUrl`
- `promptVersion`
- `status`
- `generationMode`
- `inputSystemPrompt`
- `inputUserPrompt`
- `responseText`
- `responseJson`
- `parsedOutputJson`
- `errorMessage`
- `latencyMs`
- `tokenUsageJson`

应用详情页 `/tenants/[tenantId]/applications/[appId]` 会展示最近 3 次 Agent1 模型交互日志，可展开查看输入 prompt 和模型返回。

## 平台入口

当前接入位置：

- `/tenants/[tenantId]/applications/[appId]`
- `/tenants/[tenantId]/applications`

页面中提供“AI 理解应用”按钮，点击后可填写目标网站地址和业务提示。

## SDK 使用方式

Agent1 的 `sdkRecommendations` 会建议：

- 需要补充的 `collector.track(eventName, payload)`。
- 需要在 DOM 上添加的 `data-ur-region`。
- 需要在按钮或表单上添加的 `data-ur-action`。
- 需要补充的 `data-ur-business-action`。

示例：

```html
<section data-ur-region="product_area">
  <button
    data-ur-action="product_add_to_cart"
    data-ur-business-action="将商品加入购物车"
  >
    Add to cart
  </button>
</section>
```

这样 Browser Collector SDK 上报的 `BrowserEvent` 会携带更稳定的 region/action 结构，后续 Journey 聚合和 Agent2 分析可以直接消费。

## SDK 代码生成

应用详情页会基于已保存的 Agent1 结构化结果生成一组轻量 SDK 接入代码：

- `src/lib/userReplay.ts` 初始化代码。
- React 关键交互接入示例。
- `data-ur-region`、`data-ur-action`、`data-ur-business-action` 标记。
- 对应的 `collector.track(eventName, payload)` 调用。

该步骤只读取 `ApplicationAiProfile` 中已保存的 `regionsJson` 和 `sdkRecommendationsJson`，不会再次调用模型，也不会自动修改目标应用代码。
