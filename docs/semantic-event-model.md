# Semantic Event Model

本文档定义 BrowserEvent 到 JourneyEvent 的第一版语义字段，目标是为后续 AI 解构目标应用的页面区域、动作意图和异常归因预留稳定数据结构。

## 分层原则

- `BrowserEvent` 保存 SDK 上报的原始事件语义，包含 DOM 目标、selector、viewport、scroll、request 和 AI 待解构候选。
- `JourneyEvent` 保存聚合后的可解释时间线节点，面向详情页展示和 AI 总结。
- AI 后续只补全或修正 `aiRegionStatus = PENDING` 的事件，不覆盖 `rawPayload`。

## BrowserEvent 关键字段

| 字段 | 用途 |
| --- | --- |
| `pageTemplate` | 页面模板，例如 `/products/[id]` 或 `product_list_page`。 |
| `region` | SDK 或规则识别出的页面区域，例如 `product_card`。 |
| `regionSource` | 区域来源，例如 `data_attribute`、`sdk`、`ai`、`pending_ai`。 |
| `regionConfidence` | 区域识别置信度，0 到 1。 |
| `action` | 交互动作编码，例如 `product_add_to_cart`。 |
| `actionType` | 动作来源或类型，例如 `dom_action`、`manual_track`、`form_submit`。 |
| `businessAction` | 面向业务展示的动作，例如 `加入购物车`、`点击结算`。 |
| `businessIntent` | 用户意图，例如 `checkout`、`compare_price`。 |
| `targetLabel` | 目标元素可读名称。 |
| `targetSelector` | DOM selector，用于 AI 结合页面结构推断 region。 |
| `targetRole` | DOM role 或 ARIA role。 |
| `targetText` | 目标元素文本，已按 SDK 脱敏与截断。 |
| `targetTagName` | 目标元素标签名。 |
| `targetTestId` | `data-testid` 或 `data-test-id`。 |
| `targetData` | `data-ur-*` / `data-replay-*` 扩展数据。 |
| `targetRect` | 目标元素在 viewport 中的位置和尺寸。 |
| `viewport` | 浏览器视口尺寸和 DPR。 |
| `scroll` | 当前页面滚动位置。 |
| `interaction` | 指针、键盘等交互上下文。 |
| `semanticPayload` | SDK 上报的语义 payload，供聚合和 AI 读取。 |
| `aiRegionStatus` | `PENDING`、`RESOLVED` 或 `IGNORED`。 |
| `aiRegionCandidate` | AI 解构 region 所需的页面、目标、动作、位置候选信息。 |
| `aiRegionReason` | AI 或规则给出的区域判定说明。 |

## JourneyEvent 关键字段

`JourneyEvent` 复用上述语义字段，并额外保留：

| 字段 | 用途 |
| --- | --- |
| `sourceBrowserEventId` | 指向来源 BrowserEvent 的 ID，方便追溯和重新聚合。 |
| `requestId` | 请求 ID，后续用于点击和请求归因。 |
| `requestUrl` | 原始请求 URL。 |
| `requestOutcome` | 请求结果，例如 `SUCCESS`、`FAILED`。 |
| `uiFeedback` | toast、dialog、success_state 等界面反馈。 |
| `aiRegionSuggestion` | AI 对 JourneyEvent 粒度的 region 建议。 |

## SDK 上报建议

目标应用可以通过少量 DOM 标记提升识别准确率：

```html
<section data-ur-region="product_list">
  <article data-ur-region="product_card" data-ur-object-type="product" data-ur-object-id="sku_123">
    <button data-ur-action="product_add_to_cart" data-ur-business-action="加入购物车">
      Add to cart
    </button>
  </article>
</section>
```

没有 `data-ur-region` 时，SDK 仍会上报 `targetSelector`、`targetRect`、`viewport` 和 `scroll`，并将 `aiRegionStatus` 标记为 `PENDING`，供后续 AI 解构。

