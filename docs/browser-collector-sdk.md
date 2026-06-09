# Browser Collector SDK 接入说明

本文档描述用户旅程回放平台第一版浏览器采集 SDK 的接入方式。SDK 源码位于：

`packages/browser-collector`

构建产物位于：

`packages/browser-collector/dist`

## 1. SDK 与平台 API 的关系

SDK 会把浏览器事件批量发送到：

```text
POST /api/ingest/browser-events
```

平台 API 会完成：

- `appKey + ingestToken` 鉴权
- 应用所属 tenant 校验
- host/domain 校验
- 批量事件格式校验
- `BrowserEvent` 原始事件落库
- `IntegrationLog` 接入校验日志写入

## 2. 构建 SDK

```bash
npm --prefix packages/browser-collector run build
```

## 3. Next.js / React 接入

安装本地包：

```bash
npm install ./packages/browser-collector
```

创建客户端组件：

```tsx
"use client";

import { useEffect } from "react";
import { createJourneyCollector } from "@user-replay/browser-collector";

export function UserReplayCollector() {
  useEffect(() => {
    const collector = createJourneyCollector({
      appKey: process.env.NEXT_PUBLIC_USER_REPLAY_APP_KEY!,
      ingestToken: process.env.NEXT_PUBLIC_USER_REPLAY_INGEST_TOKEN!,
      endpoint: process.env.NEXT_PUBLIC_USER_REPLAY_ENDPOINT!,
      redactKeys: ["email", "phone"],
      context: {
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
      },
    });

    return () => {
      void collector.flush();
      collector.stop();
    };
  }, []);

  return null;
}
```

环境变量示例：

```bash
NEXT_PUBLIC_USER_REPLAY_APP_KEY="nebula_console_web"
NEXT_PUBLIC_USER_REPLAY_INGEST_TOKEN="igr_xxx"
NEXT_PUBLIC_USER_REPLAY_ENDPOINT="https://user-replay-demo.vercel.app/api/ingest/browser-events"
```

## 4. 普通 script tag 接入

发布到 CDN 或将 `dist/index.js` 复制到业务系统静态资源目录后：

```html
<script type="module">
  import { createJourneyCollector } from "/vendor/user-replay/browser-collector/index.js";

  const collector = createJourneyCollector({
    appKey: "nebula_console_web",
    ingestToken: "igr_xxx",
    endpoint: "https://user-replay-demo.vercel.app/api/ingest/browser-events",
    debug: true
  });

  window.userReplayCollector = collector;
</script>
```

## 5. 自动采集范围

SDK 默认采集：

- `page_view`：首屏页面浏览
- `page_view`：SPA route change
- `ui_click`：可点击元素点击
- `form_submit`：表单提交元信息
- `network_request`：fetch / XHR 请求元信息
- `ui_error`：error / unhandledrejection

不会采集：

- 表单字段值
- fetch / XHR request body
- response body
- Cookie 明文

## 6. 绑定用户

用户登录后调用：

```ts
collector.identify("user_123", {
  plan: "enterprise",
  role: "admin",
});
```

后续事件会携带 `userId`，并在 context 中带上脱敏后的 traits。

## 7. 手工业务事件

```ts
collector.track("checkout_submit", {
  orderAmount: 299,
  coupon: "NEW_USER",
});
```

第一版 ingest API 只接受固定事件类型，因此 `track()` 会以 `ui_click` 上报，并在 `context.eventName` 中保留业务事件名。

## 8. 脱敏配置

默认脱敏：

```text
password, passwd, pwd, token, access_token, refresh_token, authorization,
auth, secret, client_secret, ingestToken, ingest_token, cookie, set-cookie
```

扩展：

```ts
createJourneyCollector({
  appKey: "nebula_console_web",
  ingestToken: "igr_xxx",
  endpoint: "https://user-replay-demo.vercel.app/api/ingest/browser-events",
  redactKeys: ["email", "phone", "idCard"],
});
```

## 9. 验证方式

1. 启动平台。
2. 进入 `/tenants/[tenantId]/applications/[appId]`。
3. 选择应用，复制 `appKey` 与 `ingestToken`。
4. 在业务应用初始化 SDK。
5. 打开页面、点击按钮或执行：

```ts
collector.track("manual_verify", {
  source: "browser_console",
});
await collector.flush();
```

6. 回到应用详情页或旅程列表查看：

- “当前应用最近校验日志”出现 `ingest.browser-events`
- “当前应用最近原始事件”出现 `page_view`、`ui_click` 等事件

## 10. 生产使用建议

- `ingestToken` 属于可公开前端 token，但仍应按应用维度定期轮换。
- 生产环境建议配置 CORS 来源白名单；当前 Demo API 使用宽松 CORS，便于验证。
- 后续版本可增加 sampling、插件式采集、离线队列和真实 Journey 聚合。
