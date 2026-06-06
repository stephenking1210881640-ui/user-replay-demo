# InsightFlow 用户回放平台 Demo

这是一个基于 `Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Prisma` 的前后端一体 Demo，用于验证“用户回放平台”的产品方向、页面结构和分析闭环。

核心目标不是做真实录屏系统，而是把以下闭环跑通：

- Web 应用接入信息展示
- 用户列表与用户详情
- 旅程列表与旅程详情 / 回放
- 研究项目详情
- AI 对单条旅程的摘要、目标达成分析、异常分析

## 技术栈

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- SQLite 本地开发
- 线上可切换 PostgreSQL / Neon

## 已实现页面

- `/integration`
- `/users`
- `/users/[id]`
- `/journeys`
- `/journeys/[id]`
- `/projects`
- `/projects/[id]`

## 已实现数据模型

- `Application`
- `User`
- `Tag`
- `UserTag`
- `Journey`
- `JourneyTag`
- `Project`
- `ProjectJourney`
- `JourneyEvent`
- `Evidence`
- `IntegrationLog`
- `ProjectFinding`

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run db:setup
```

这一步会完成两件事：

1. 初始化本地 SQLite 数据库
2. 写入带叙事性的 seed 数据

当前 seed 至少覆盖 5 类典型旅程：

- 已完成
- 未完成
- 异常
- 长停滞犹豫
- 仅浏览退出

### 3. 启动开发环境

```bash
npm run dev
```

默认访问：

- `http://localhost:3000/integration`

## 常用命令

```bash
npm run dev
npm run lint
npm run build
npm run db:push
npm run db:seed
npm run db:setup
npm run db:reset
npm run db:studio
```

## 数据库说明

### 本地开发

本地默认使用 SQLite：

```env
DATABASE_URL="file:./dev.db"
```

数据库文件位于：

```text
prisma/dev.db
```

由于当前环境下 Prisma 6 的 `db push` 对本地 SQLite 会触发 schema engine 异常，本项目对本地开发做了一个稳定化处理：

- `npm run db:push` 会调用 `scripts/db-push.mjs`
- 该脚本会用 `prisma migrate diff` 生成建表 SQL
- 然后通过 `sqlite3` 初始化 SQLite 数据库

这不会影响 Prisma Client 的正常使用，也不影响页面和 API 查询。

### 切换到 PostgreSQL / Neon

当前 schema 没有使用 SQLite 专属字段类型，模型保持了数据库中立写法。切换到 Neon 时建议：

1. 把 [prisma/schema.prisma](./prisma/schema.prisma) 中的 datasource provider 从 `sqlite` 改成 `postgresql`
2. 将 `DATABASE_URL` 替换为 Neon 连接串
3. 执行 `npx prisma generate`
4. 在线上数据库执行 schema push 或 migration

示例：

```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
```

当前代码层没有写任何 SQLite-only 的 SQL，也没有依赖 SQLite 特有函数。

## 项目结构

```text
app/
  api/
  integration/
  journeys/
  projects/
  users/
components/
  journeys/
  layout/
  shared/
  ui/
lib/
  data.ts
  format.ts
  prisma.ts
prisma/
  schema.prisma
  seed.ts
scripts/
  db-push.mjs
```

## 写操作接口

当前保留少量 Route Handler 用于写操作：

- `POST /api/projects`
- `POST /api/projects/[projectId]/journeys`

读取逻辑优先走 Server Component + Prisma 直接查询，没有把所有读请求强制改成 API。

## 非目标

当前 Demo 明确不做以下内容：

- 登录鉴权
- 真实录屏上传
- 外部 AI 接口调用
- WebSocket 实时推送
- 热力图
- 复杂图表
- 文件上传
- 多租户权限体系
- 移动端适配

## 验证结果

已完成以下本地验证：

- `npm run db:setup`
- `npm run lint`
- `npm run build`

## 部署到 Vercel

### 推荐环境变量

```env
DATABASE_URL=<Neon PostgreSQL URL>
```

### 部署步骤

1. 将项目根目录设置为 `apps/user-replay-demo`
2. 在 Vercel 中配置 `DATABASE_URL`
3. 将 Prisma datasource provider 切换为 `postgresql`
4. 执行一次 Prisma schema 初始化
5. 使用默认 `npm run build` 构建

### 构建命令

```bash
npm run build
```

### 启动命令

```bash
npm run start
```

## 说明

当前仓库里的原型 HTML 仅作为视觉参考，页面已经全部重写为 React 组件，没有直接嵌入原型 HTML。
