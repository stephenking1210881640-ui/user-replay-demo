# Browser Collector SDK

`@user-replay/browser-collector` 是用户旅程回放平台的第一版浏览器采集 SDK。它运行在 Web 浏览器中，自动采集页面、点击、表单、网络请求和错误事件，并批量上报到平台的 ingest API。

## 安装

本仓库内本地引用：

```bash
npm install ./packages/browser-collector
```

发布到私有 npm 后：

```bash
npm install @user-replay/browser-collector
```

## 初始化

```ts
import { createJourneyCollector } from "@user-replay/browser-collector";

const collector = createJourneyCollector({
  appKey: "nebula_console_web",
  ingestToken: "igr_xxx",
  endpoint: "https://user-replay-demo.vercel.app/api/ingest/browser-events",
  host: "console.example.com",
  debug: true,
  redactKeys: ["phone", "idCard"],
});

collector.identify("user_123", {
  plan: "enterprise",
  role: "admin",
});

collector.track("upgrade_button_clicked", {
  source: "billing_page",
});
```

`createJourneyCollector` 默认会立即开始采集。如果希望延迟启动：

```ts
const collector = createJourneyCollector({
  appKey: "nebula_console_web",
  ingestToken: "igr_xxx",
  endpoint: "https://user-replay-demo.vercel.app/api/ingest/browser-events",
  autoStart: false,
});

collector.start();
```

## Next.js / React 接入

在 App Router 项目中创建一个客户端组件：

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
    });

    return () => {
      void collector.flush();
      collector.stop();
    };
  }, []);

  return null;
}
```

在 `app/layout.tsx` 中挂载：

```tsx
import { UserReplayCollector } from "@/components/user-replay-collector";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <UserReplayCollector />
        {children}
      </body>
    </html>
  );
}
```

## 普通 script tag 接入

如果包已经发布到私有 npm/CDN，可以用 ESM script 直接接入：

```html
<script type="module">
  import { createJourneyCollector } from "https://cdn.example.com/@user-replay/browser-collector/dist/index.js";

  const collector = createJourneyCollector({
    appKey: "nebula_console_web",
    ingestToken: "igr_xxx",
    endpoint: "https://user-replay-demo.vercel.app/api/ingest/browser-events",
    debug: true
  });

  window.userReplayCollector = collector;
</script>
```

也可以将 `packages/browser-collector/dist/index.js` 复制到业务站点静态资源目录后用相同方式导入。

## 自动采集范围

默认开启：

- `page_view`：初始化时自动采集一次页面浏览。
- `route change`：监听 `history.pushState`、`history.replaceState` 和 `popstate`，自动补充 SPA 路由切换 page view。
- `ui_click`：采集 `a`、`button`、`input`、`select`、`textarea`、`[role=button]`、`[data-track]` 的点击元信息。
- `form_submit`：采集表单提交元信息，仅采集字段名称、类型、required，不采集字段值。
- `network_request`：hook `fetch` 和 `XMLHttpRequest`，采集 URL、host、method、status、duration，不采集 request body / response body。
- `ui_error`：监听 `window.error` 和 `unhandledrejection`。

可通过配置关闭：

```ts
createJourneyCollector({
  appKey: "nebula_console_web",
  ingestToken: "igr_xxx",
  endpoint: "https://user-replay-demo.vercel.app/api/ingest/browser-events",
  autoTrackClick: false,
  autoTrackNetwork: false,
});
```

## API

```ts
const collector = createJourneyCollector(config);
```

可用方法：

- `collector.start()`：开始自动采集。
- `collector.stop()`：停止自动采集，并恢复 fetch / XHR hook。
- `collector.identify(userId, traits)`：绑定登录用户。
- `collector.track(eventName, payload)`：手工补充业务动作，当前版本会上报为 `ui_click`，并在 `context.eventName` 中保留业务事件名。
- `collector.flush()`：立即批量上报队列事件。
- `collector.reset()`：清理 anonymousId / sessionId / userId 并重新开始。
- `collector.getSessionId()`：读取当前 sessionId。
- `collector.getAnonymousId()`：读取当前 anonymousId。

模块级快捷方法：

```ts
import { init, identify, track, flush, reset } from "@user-replay/browser-collector";

init(config);
identify("user_123");
track("checkout_submit");
await flush();
reset();
```

## 初始化参数

```ts
type JourneyCollectorConfig = {
  appKey: string;
  ingestToken?: string;
  token?: string;
  endpoint: string;
  host?: string;
  debug?: boolean;
  autoStart?: boolean;
  autoTrackPageView?: boolean;
  autoTrackRouteChange?: boolean;
  autoTrackClick?: boolean;
  autoTrackFormSubmit?: boolean;
  autoTrackNetwork?: boolean;
  autoTrackErrors?: boolean;
  batchSize?: number;
  flushIntervalMs?: number;
  sessionTimeoutMs?: number;
  redactKeys?: string[];
  context?: Record<string, unknown>;
};
```

## 脱敏规则

SDK 会递归脱敏 `context`、`track payload`、错误对象和用户 traits。

默认脱敏字段：

```text
password, passwd, pwd, token, access_token, refresh_token, authorization,
auth, secret, client_secret, ingestToken, ingest_token, cookie, set-cookie
```

扩展脱敏字段：

```ts
createJourneyCollector({
  appKey: "nebula_console_web",
  ingestToken: "igr_xxx",
  endpoint: "https://user-replay-demo.vercel.app/api/ingest/browser-events",
  redactKeys: ["phone", "email", "idCard"],
});
```

## 如何验证上报成功

1. 在平台进入租户接入页：`/tenants/[tenantId]/integration`。
2. 选择对应应用，复制 `appKey` 和 `ingestToken`。
3. 在业务站点初始化 SDK。
4. 打开页面并点击任意按钮，或执行：

```ts
collector.track("manual_verify", {
  source: "browser_console",
});
collector.flush();
```

5. 回到平台接入页，查看：

- “当前应用最近校验日志”是否出现 `ingest.browser-events`。
- “当前应用最近原始事件”是否出现 `page_view`、`ui_click` 或其他事件。

## 当前限制

- 第一版只做浏览器事件接入，不做录屏、DOM 快照、热力图和 Journey 聚合。
- `track()` 目前映射为 `ui_click` 类型，并通过 `context.eventName` 保留业务动作名称。
- SDK 不采集请求体、响应体、表单值，避免第一版引入高风险敏感数据。
