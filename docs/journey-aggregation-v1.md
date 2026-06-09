# Journey 聚合 V1 说明

本文档描述第一版从 `BrowserEvent` 聚合为 `Journey` 的规则。

## 数据流

```text
Browser Collector SDK
  -> POST /api/ingest/browser-events
  -> BrowserEvent
  -> Journey Aggregator
  -> Journey / JourneyEvent / Evidence / User
  -> overview / users / journeys
```

## 触发方式

当前版本支持两种触发：

1. 页面读取前自动轻量聚合

以下页面的数据函数会在查询前尝试聚合当前租户未处理的 `BrowserEvent`：

- `/tenants/[tenantId]/overview`
- `/tenants/[tenantId]/users`
- `/tenants/[tenantId]/journeys`
- `/tenants/[tenantId]/applications/[appId]`

2. 手动 API 触发

```bash
curl -X POST http://localhost:3000/api/jobs/aggregate-browser-events \
  -H "Content-Type: application/json" \
  --data '{
    "tenantSlug": "nebula-tech",
    "inactivityTimeoutMs": 1800000
  }'
```

## 聚合主线

- 以 `applicationId + sessionId` 作为主线。
- 按 `timestamp` 升序排序。
- 默认以 30 分钟无活动作为切分边界。
- 一批未聚合事件会生成一条或多条 `Journey`。
- 聚合完成后，`BrowserEvent.journeyId` 会指向生成的 `Journey`，并写入 `aggregatedAt`，避免重复聚合。

## 时间计算

- `startedAt`：该 journey 第一条事件的 `timestamp`。
- `endedAt`：该 journey 最后一条事件的 `timestamp`。
- `totalDurationMs`：`endedAt - startedAt`，最小为 1000ms。
- `effectiveDurationMs`：相邻事件间隔求和，每个间隔最多按 inactivity timeout 计入，最小为 1000ms。

## 指标统计

- `pageCount`：`eventType = page_view` 的数量。
- `keyActionCount`：`eventType in (ui_click, form_submit)` 的数量。
- `requestCount`：`eventType = network_request` 的数量。
- `hasAnomaly`：存在 `ui_error`，或存在 `network_request` 且 `requestStatus >= 400`。

## 状态判断

状态使用现有 `JourneyResultStatus`：

- `FAILED`：存在 `ui_error` 或失败请求。
- `COMPLETED`：存在 `form_submit`，或手工 `track()` 的 `context.eventName` 包含 `complete / success / submit / checkout / purchase / add_to_cart / confirm / finish`。
- `BROWSING`：只有页面浏览，没有点击或表单提交。
- `ABANDONED`：有交互但没有完成动作，也没有异常。

## 生成内容

每条聚合 journey 会生成：

- `Journey`
- `JourneyEvent`
- `Evidence`：仅针对失败请求和错误事件生成
- `User`：按 `userId` 优先，否则使用 `anonymousId`
- `JourneyTag`：自动关联“真实事件聚合”标签

## 数据来源区分

`Journey.source` 用于区分数据来源：

- `REAL`：由真实 `BrowserEvent` 聚合生成。
- `DEMO`：seed/demo fallback 数据。

页面会展示“真实聚合”或“Demo fallback”标识。

## 验证路径

1. 在 `/tenants/[tenantId]/applications` 创建测试应用。
2. 将 Browser Collector SDK 接入外部应用。
3. 打开外部应用并触发页面浏览、点击、表单或请求。
4. 在 `/tenants/[tenantId]/applications/[appId]` 或旅程列表查看最近真实数据。
5. 刷新 `/tenants/[tenantId]/journeys`，页面会自动尝试聚合未处理事件。
6. 在 journeys 列表中查看带“真实聚合”标识的旅程。
7. 打开旅程详情，查看由真实事件生成的时间线、摘要和证据。

## 后续演进

- 将页面读取前聚合改为 Vercel Cron 或队列任务。
- 引入更稳定的业务目标定义，替代正则推断完成状态。
- 将 AI summary 从模板摘要升级为模型总结。
- 支持跨批次追加事件到尚未结束的 journey。
