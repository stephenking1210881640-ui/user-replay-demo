import {
  ApplicationStatus,
  EvidenceSeverity,
  EvidenceType,
  FindingCategory,
  JourneyEventType,
  JourneyResultStatus,
  PrismaClient,
  TagSource,
  TagType,
  TenantPlan,
  TenantStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const now = new Date("2026-06-02T10:00:00.000Z");

type JourneyStorySeed = {
  events: Array<{
    seq: number;
    offsetMs: number;
    type: JourneyEventType;
    title: string;
    description: string;
    pageUrl?: string;
    pageTemplate?: string;
    pageTitle?: string;
    region?: string;
    uiAction?: string;
    businessAction?: string;
    businessIntent?: string;
    targetLabel?: string;
    requestHost?: string;
    method?: string;
    pathTemplate?: string;
    statusCode?: number;
    durationMs?: number;
    requestOutcome?: string;
    uiFeedback?: string;
    isAnomaly?: boolean;
  }>;
  evidences: Array<{
    eventSeq?: number;
    type: EvidenceType;
    title: string;
    description: string;
    severity: EvidenceSeverity;
    offsetMs: number;
    content?: string;
  }>;
};

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function hoursAgo(hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNarrative(value: string, fieldLabel: string, entityCode: string, minLength = 18) {
  invariant(value.trim().length >= minLength, `${entityCode} 的 ${fieldLabel} 过短或为空。`);
}

async function validateSeedIntegrity() {
  const [tenants, applications, users, journeys, tags, projects] = await Promise.all([
    prisma.tenant.findMany({
      include: {
        applications: true,
        users: true,
        journeys: true,
        tags: true,
        projects: true,
      },
      orderBy: { slug: "asc" },
    }),
    prisma.application.findMany({
      include: {
        tenant: true,
        users: true,
        journeys: true,
      },
    }),
    prisma.user.findMany({
      include: {
        tenant: true,
        application: true,
        journeys: true,
      },
    }),
    prisma.journey.findMany({
      include: {
        tenant: true,
        application: true,
        user: true,
        journeyTags: {
          include: { tag: true },
        },
        events: {
          orderBy: { seq: "asc" },
        },
        evidences: true,
      },
    }),
    prisma.tag.findMany({
      include: {
        tenant: true,
        application: true,
      },
    }),
    prisma.project.findMany({
      include: {
        tenant: true,
        application: true,
        projectJourneys: true,
      },
    }),
  ]);

  invariant(tenants.length >= 3, "租户数量不足。");
  invariant(applications.length >= 4, "应用数量不足。");
  invariant(users.length >= 9, "用户数量不足。");
  invariant(journeys.length >= 12, "旅程数量不足。");
  invariant(projects.length >= 6, "项目数量不足。");

  for (const tenant of tenants) {
    invariant(tenant.applications.length >= 1, `${tenant.slug} 没有应用。`);
    invariant(tenant.users.length >= 3, `${tenant.slug} 的用户样本不足。`);
    invariant(tenant.journeys.length >= 4, `${tenant.slug} 的旅程样本不足。`);
    invariant(tenant.tags.length >= 6, `${tenant.slug} 的标签样本不足。`);
    invariant(tenant.projects.length >= 1, `${tenant.slug} 的项目样本不足。`);
  }

  for (const application of applications) {
    invariant(application.tenantId === application.tenant.id, `${application.name} tenant 关系异常。`);
  }

  for (const user of users) {
    invariant(user.tenantId === user.tenant.id, `${user.externalId} tenant 关系异常。`);
    invariant(user.applicationId === user.application.id, `${user.externalId} application 关系异常。`);
    invariant(user.tenantId === user.application.tenantId, `${user.externalId} 跨租户引用了应用。`);
  }

  for (const tag of tags) {
    invariant(tag.tenantId === tag.tenant.id, `${tag.name} tenant 关系异常。`);
    invariant(tag.tenantId === tag.application.tenantId, `${tag.name} 跨租户引用了应用。`);
  }

  for (const journey of journeys) {
    invariant(journey.tenantId === journey.tenant.id, `${journey.journeyCode} tenant 关系异常。`);
    invariant(journey.tenantId === journey.user.tenantId, `${journey.journeyCode} 跨租户引用了用户。`);
    invariant(journey.tenantId === journey.application.tenantId, `${journey.journeyCode} 跨租户引用了应用。`);
    invariant(journey.events.length >= 2, `${journey.journeyCode} 缺少关键时间线。`);
    invariant(journey.journeyTags.length >= 1, `${journey.journeyCode} 缺少旅程标签。`);
    invariant(journey.totalDurationMs > 0, `${journey.journeyCode} 总时长缺失。`);
    invariant(journey.effectiveDurationMs > 0, `${journey.journeyCode} 有效时长缺失。`);
    assertNarrative(journey.aiSummaryShort, "AI 一句话摘要", journey.journeyCode);
    assertNarrative(journey.aiScenarioSummary, "使用场景还原", journey.journeyCode);
    assertNarrative(journey.aiProcessSummary, "行为过程还原", journey.journeyCode);
    assertNarrative(journey.aiGoalAnalysis, "目标达成分析", journey.journeyCode);
    assertNarrative(journey.aiAnomalyAnalysis, "异常行为摘要", journey.journeyCode);

    if (journey.hasAnomaly || journey.resultStatus === JourneyResultStatus.FAILED) {
      invariant(journey.evidences.length >= 1, `${journey.journeyCode} 异常样本缺少证据。`);
    }
  }

  for (const project of projects) {
    invariant(project.tenantId === project.tenant.id, `${project.name} tenant 关系异常。`);
    invariant(project.tenantId === project.application.tenantId, `${project.name} 跨租户引用了应用。`);
    invariant(project.projectJourneys.length >= 1, `${project.name} 没有样本旅程。`);
  }
}

type TenantDataset = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    industry: string;
    plan: TenantPlan;
    status: TenantStatus;
    description: string;
  };
  applications: Array<{
    id: string;
    name: string;
    appKey: string;
    host: string;
    description: string;
    status: ApplicationStatus;
    ingestToken: string;
    createdAt: Date;
    updatedAt: Date;
    lastReportedAt: Date;
  }>;
  tags: Array<{
    name: string;
    type: TagType;
    source: TagSource;
    color: string;
    description: string;
    applicationId: string;
  }>;
  users: Array<{
    id: string;
    applicationId: string;
    externalId: string;
    name: string;
    email: string;
    avatarSeed: string;
    deviceType: string;
    os: string;
    browser: string;
    location: string;
    firstSeenAt: Date;
    lastActiveAt: Date;
    tags: string[];
  }>;
  journeys: Array<{
    id: string;
    applicationId: string;
    userId: string;
    journeyCode: string;
    title: string;
    startedAt: Date;
    endedAt: Date;
    totalDurationMs: number;
    effectiveDurationMs: number;
    pageCount: number;
    keyActionCount: number;
    requestCount: number;
    resultStatus: JourneyResultStatus;
    hasAnomaly: boolean;
    pageUrl: string;
    pageTemplate: string;
    pageTitle: string;
    businessActionType: string;
    aiSummaryShort: string;
    aiScenarioSummary: string;
    aiProcessSummary: string;
    aiGoalAnalysis: string;
    aiAnomalyAnalysis: string;
    createdAt: Date;
    tags: string[];
  }>;
  projects: Array<{
    id: string;
    applicationId: string;
    projectCode: string;
    name: string;
    goal: string;
    focusArea: string;
    focusTarget: string;
    focusFeature: string;
    ownerName: string;
    description: string;
    filterTimeRangeLabel: string;
    filterPageTemplates: string;
    filterStatuses: string;
    filterTagRules: string;
    createdAt: Date;
    journeyCodes: string[];
    findings: Array<{
      title: string;
      summary: string;
      category: FindingCategory;
      evidenceJourneyCount: number;
      sortOrder: number;
    }>;
  }>;
  integrationLogs: Array<{
    applicationId: string;
    level: string;
    status: string;
    source: string;
    message: string;
    payloadSummary: string;
    createdAt: Date;
  }>;
  stories: Record<string, JourneyStorySeed>;
};

const datasets: TenantDataset[] = [
  {
    tenant: {
      id: "tnt_240601_001",
      name: "星云科技",
      slug: "nebula-tech",
      industry: "B2B 软件",
      plan: TenantPlan.ENTERPRISE,
      status: TenantStatus.ACTIVE,
      description: "面向企业运营与分析团队的 SaaS 产品，重点观察接入配置、报表导出与企业版升级链路。",
    },
    applications: [
      {
        id: "app_240601_101",
        name: "Nebula Console",
        appKey: "nebula_console_web",
        host: "console.nebula-tech.com",
        description: "企业控制台，包含 onboarding、workspace 和 upgrade 等核心链路。",
        status: ApplicationStatus.ACTIVE,
        ingestToken: "igr_nebula_console_7f3a9c2d1e",
        createdAt: daysAgo(45),
        updatedAt: daysAgo(1),
        lastReportedAt: minutesAgo(5),
      },
      {
        id: "app_240601_102",
        name: "Nebula Docs",
        appKey: "nebula_docs_web",
        host: "help.nebula-tech.com",
        description: "帮助中心与 API 文档站，观察信息理解与开发者浏览行为。",
        status: ApplicationStatus.ACTIVE,
        ingestToken: "igr_nebula_docs_3b8d4f1a6c",
        createdAt: daysAgo(38),
        updatedAt: daysAgo(2),
        lastReportedAt: hoursAgo(6),
      },
    ],
    tags: [
      { name: "核心客户", type: TagType.USER, source: TagSource.MANUAL, color: "#dbeafe", description: "重点付费客户或高潜在续费客户。", applicationId: "app_240601_101" },
      { name: "管理员角色", type: TagType.USER, source: TagSource.SYSTEM, color: "#e0f2fe", description: "具备配置权限的控制台管理员。", applicationId: "app_240601_101" },
      { name: "升级意向", type: TagType.USER, source: TagSource.RULE, color: "#ede9fe", description: "最近多次进入升级与席位调整流程。", applicationId: "app_240601_101" },
      { name: "权限犹豫", type: TagType.JOURNEY, source: TagSource.MANUAL, color: "#fae8ff", description: "在授权范围与权限说明区域反复停留。", applicationId: "app_240601_101" },
      { name: "导出失败", type: TagType.JOURNEY, source: TagSource.SYSTEM, color: "#fee2e2", description: "报表导出或查询请求失败，阻断目标完成。", applicationId: "app_240601_101" },
      { name: "升级犹豫", type: TagType.JOURNEY, source: TagSource.MANUAL, color: "#fde68a", description: "在席位、价格或版本差异处犹豫并放弃。", applicationId: "app_240601_101" },
      { name: "顺利完成", type: TagType.JOURNEY, source: TagSource.RULE, color: "#dcfce7", description: "标准健康路径样本。", applicationId: "app_240601_101" },
      { name: "仅浏览退出", type: TagType.JOURNEY, source: TagSource.RULE, color: "#e2e8f0", description: "只完成浏览动作后离开。", applicationId: "app_240601_102" },
    ],
    users: [
      {
        id: "usr_240601_101",
        applicationId: "app_240601_101",
        externalId: "U-240601-101",
        name: "Alex Tan",
        email: "alex.tan@nebula-tech.com",
        avatarSeed: "A",
        deviceType: "Desktop",
        os: "macOS 14.5",
        browser: "Chrome 126",
        location: "上海",
        firstSeenAt: daysAgo(56),
        lastActiveAt: minutesAgo(9),
        tags: ["核心客户", "管理员角色"],
      },
      {
        id: "usr_240601_102",
        applicationId: "app_240601_101",
        externalId: "U-240601-102",
        name: "Rachel Qiu",
        email: "rachel.qiu@nebula-tech.com",
        avatarSeed: "R",
        deviceType: "Desktop",
        os: "Windows 11",
        browser: "Edge 126",
        location: "杭州",
        firstSeenAt: daysAgo(31),
        lastActiveAt: hoursAgo(3),
        tags: ["升级意向", "管理员角色"],
      },
      {
        id: "usr_240601_103",
        applicationId: "app_240601_102",
        externalId: "U-240601-103",
        name: "Kevin Sun",
        email: "kevin.sun@nebula-tech.com",
        avatarSeed: "K",
        deviceType: "Mobile Web",
        os: "iOS 17",
        browser: "Safari Mobile",
        location: "深圳",
        firstSeenAt: daysAgo(14),
        lastActiveAt: hoursAgo(7),
        tags: ["管理员角色"],
      },
    ],
    journeys: [
      {
        id: "jny_240601_101",
        applicationId: "app_240601_101",
        userId: "usr_240601_101",
        journeyCode: "J-240601-101",
        title: "权限说明停滞后完成组织接入",
        startedAt: hoursAgo(12),
        endedAt: new Date(hoursAgo(12).getTime() + 356000),
        totalDurationMs: 356000,
        effectiveDurationMs: 241000,
        pageCount: 5,
        keyActionCount: 11,
        requestCount: 4,
        resultStatus: JourneyResultStatus.COMPLETED,
        hasAnomaly: false,
        pageUrl: "https://console.nebula-tech.com/onboarding",
        pageTemplate: "/onboarding",
        pageTitle: "组织接入",
        businessActionType: "初始化配置",
        aiSummaryShort: "管理员在权限说明页停留较久并反复展开细节文案，但最终仍完成组织接入配置。",
        aiScenarioSummary: "这是企业首次接入场景，用户目标非常明确，即尽快完成初始化配置并进入工作台。",
        aiProcessSummary: "用户顺利填写组织信息与数据源，真正的停滞集中在权限说明与授权范围理解，之后继续完成配置。",
        aiGoalAnalysis: "目标已达成，但说明文案增加了理解成本，适合作为 onboarding 优化样本。",
        aiAnomalyAnalysis: "没有系统级异常，主要风险来自权限说明带来的认知犹豫。",
        createdAt: hoursAgo(12),
        tags: ["权限犹豫", "顺利完成"],
      },
      {
        id: "jny_240601_102",
        applicationId: "app_240601_101",
        userId: "usr_240601_101",
        journeyCode: "J-240601-102",
        title: "导出月报时查询超时导致失败",
        startedAt: hoursAgo(6),
        endedAt: new Date(hoursAgo(6).getTime() + 194000),
        totalDurationMs: 194000,
        effectiveDurationMs: 142000,
        pageCount: 3,
        keyActionCount: 8,
        requestCount: 5,
        resultStatus: JourneyResultStatus.FAILED,
        hasAnomaly: true,
        pageUrl: "https://console.nebula-tech.com/reports",
        pageTemplate: "/reports",
        pageTitle: "经营看板",
        businessActionType: "报表导出",
        aiSummaryShort: "用户已完成筛选设置并发起月报导出，但导出任务请求超时，错误提示后直接退出页面。",
        aiScenarioSummary: "本次旅程发生在业务复盘场景，导出月报是用户的明确目标，失败会直接影响日常运营工作。",
        aiProcessSummary: "用户先设置时间范围和数据口径，随后点击导出；导出任务排队后超时失败，页面没有给出可恢复路径。",
        aiGoalAnalysis: "目标未达成，阻断点是导出任务的后端超时与前端恢复能力不足。",
        aiAnomalyAnalysis: "存在明确异常：报表导出请求返回 504，同时 toast 仅提示失败，没有补偿或重试建议。",
        createdAt: hoursAgo(6),
        tags: ["导出失败"],
      },
      {
        id: "jny_240601_103",
        applicationId: "app_240601_101",
        userId: "usr_240601_102",
        journeyCode: "J-240601-103",
        title: "升级席位价格理解不清后放弃提交",
        startedAt: hoursAgo(20),
        endedAt: new Date(hoursAgo(20).getTime() + 278000),
        totalDurationMs: 278000,
        effectiveDurationMs: 196000,
        pageCount: 4,
        keyActionCount: 7,
        requestCount: 3,
        resultStatus: JourneyResultStatus.ABANDONED,
        hasAnomaly: false,
        pageUrl: "https://console.nebula-tech.com/billing/upgrade",
        pageTemplate: "/billing/upgrade",
        pageTitle: "企业版升级",
        businessActionType: "版本升级",
        aiSummaryShort: "用户多次切换席位数量与版本对比，但对年付价格构成缺乏把握，最终未提交升级。",
        aiScenarioSummary: "这是高价值的企业版升级场景，用户关注点集中在席位价格、权益差异与实际预算。",
        aiProcessSummary: "用户浏览版本权益后进入席位调整，反复切换不同数量并展开价格说明，最后停留后离开。",
        aiGoalAnalysis: "目标未达成，阻塞并非技术异常，而是价格解释与权益差异呈现不够直接。",
        aiAnomalyAnalysis: "没有系统错误，但明显存在认知成本过高导致的转化流失。",
        createdAt: hoursAgo(20),
        tags: ["升级犹豫"],
      },
      {
        id: "jny_240601_104",
        applicationId: "app_240601_102",
        userId: "usr_240601_103",
        journeyCode: "J-240601-104",
        title: "浏览 API 文档后退出",
        startedAt: daysAgo(2),
        endedAt: new Date(daysAgo(2).getTime() + 104000),
        totalDurationMs: 104000,
        effectiveDurationMs: 76000,
        pageCount: 3,
        keyActionCount: 4,
        requestCount: 2,
        resultStatus: JourneyResultStatus.BROWSING,
        hasAnomaly: false,
        pageUrl: "https://help.nebula-tech.com/api/authentication",
        pageTemplate: "/docs/[slug]",
        pageTitle: "API 认证说明",
        businessActionType: "文档浏览",
        aiSummaryShort: "用户查看了 API 认证与错误码说明，但没有点击接入示例或继续浏览更多文档。",
        aiScenarioSummary: "这是开发者前期信息收集场景，用户目标偏向理解接入成本而非立即执行核心动作。",
        aiProcessSummary: "用户进入认证文档后阅读首屏说明，再切换到错误码区域，随后直接退出站点。",
        aiGoalAnalysis: "没有证据表明用户已经进入深度接入阶段，但可确认其尚未进入下一步实践动作。",
        aiAnomalyAnalysis: "未发现系统异常，该样本更适合研究文档首屏是否缺少明确的下一步引导。",
        createdAt: daysAgo(2),
        tags: ["仅浏览退出"],
      },
    ],
    projects: [
      {
        id: "prj_240601_101",
        applicationId: "app_240601_101",
        projectCode: "P-240601-101",
        name: "首次接入成功率验证",
        goal: "验证企业管理员在首次接入阶段是否能快速理解授权边界并顺利完成组织初始化。",
        focusArea: "Onboarding 转化",
        focusTarget: "企业管理员",
        focusFeature: "组织接入 / 权限说明",
        ownerName: "顾南希",
        description: "收集首次接入完成样本与权限犹豫样本，区分“是否成功”与“成功成本是否合理”。",
        filterTimeRangeLabel: "近 14 天首次接入旅程",
        filterPageTemplates: "/onboarding, /workspace",
        filterStatuses: "已完成",
        filterTagRules: "权限犹豫, 顺利完成",
        createdAt: daysAgo(8),
        journeyCodes: ["J-240601-101"],
        findings: [
          {
            title: "权限说明是最明显的理解停滞点",
            summary: "接入链路总体可以完成，但权限说明区域的长停留显著拉长了初始化成本。",
            category: FindingCategory.INTERACTION,
            evidenceJourneyCount: 1,
            sortOrder: 1,
          },
        ],
      },
      {
        id: "prj_240601_102",
        applicationId: "app_240601_101",
        projectCode: "P-240601-102",
        name: "企业版升级转化研究",
        goal: "观察企业客户在版本升级与席位扩容时的理解阻塞，定位价格解释与权益表达问题。",
        focusArea: "商业化转化",
        focusTarget: "高潜升级客户",
        focusFeature: "版本升级 / 席位调整",
        ownerName: "邵宇",
        description: "以升级犹豫样本和导出受阻样本为对照，区分短期需求驱动与长期付费意愿。",
        filterTimeRangeLabel: "近 30 天升级旅程",
        filterPageTemplates: "/billing/upgrade, /reports",
        filterStatuses: "中途放弃, 异常失败",
        filterTagRules: "升级犹豫, 导出失败",
        createdAt: daysAgo(12),
        journeyCodes: ["J-240601-102", "J-240601-103"],
        findings: [
          {
            title: "升级页面的价格解释仍不够直接",
            summary: "席位数量变化会影响预算，但价格说明被拆散在多个区域，用户难以快速形成决策。",
            category: FindingCategory.INSIGHT,
            evidenceJourneyCount: 1,
            sortOrder: 1,
          },
          {
            title: "导出失败会放大升级价值感知风险",
            summary: "当关键分析动作失败时，用户对高级版能力的感知也会同步受损。",
            category: FindingCategory.TECHNICAL,
            evidenceJourneyCount: 1,
            sortOrder: 2,
          },
        ],
      },
    ],
    integrationLogs: [
      { applicationId: "app_240601_101", level: "info", status: "已接收", source: "collector.browser", message: "page_view 事件已入库，组织接入页面识别成功", payloadSummary: "/onboarding · page_title=组织接入", createdAt: minutesAgo(6) },
      { applicationId: "app_240601_101", level: "warn", status: "部分降级", source: "report-exporter", message: "导出任务队列出现超时重试", payloadSummary: "job=monthly_export · retry=1", createdAt: hoursAgo(6) },
      { applicationId: "app_240601_101", level: "error", status: "异常", source: "api.reports", message: "导出任务返回 504", payloadSummary: "GET /api/reports/export -> 504", createdAt: hoursAgo(6) },
      { applicationId: "app_240601_102", level: "info", status: "已校验", source: "validator", message: "帮助中心页面模板识别通过", payloadSummary: "templates=/docs/[slug]", createdAt: hoursAgo(7) },
    ],
    stories: {
      "J-240601-101": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入组织接入页", description: "管理员进入首次接入流程。", pageUrl: "https://console.nebula-tech.com/onboarding", pageTemplate: "/onboarding", pageTitle: "组织接入", businessIntent: "完成初始化配置" },
          { seq: 2, offsetMs: 38000, type: JourneyEventType.BUSINESS_ACTION, title: "填写组织信息", description: "用户完成组织名称与数据源信息填写。", region: "组织信息表单", uiAction: "submit", businessAction: "组织配置", targetLabel: "下一步", pageTemplate: "/onboarding", pageTitle: "组织接入" },
          { seq: 3, offsetMs: 142000, type: JourneyEventType.REGION_ACTION, title: "反复展开权限说明", description: "用户在权限说明区域长时间停留并多次展开 FAQ。", region: "权限说明 FAQ", uiAction: "expand_panel", businessAction: "权限确认", targetLabel: "查看详细解释", pageTemplate: "/onboarding/permissions", pageTitle: "权限说明" },
          { seq: 4, offsetMs: 221000, type: JourneyEventType.REQUEST, title: "保存权限配置", description: "权限配置请求成功，继续进入工作台。", requestHost: "api.nebula-tech.com", method: "POST", pathTemplate: "/api/onboarding/permissions", statusCode: 200, durationMs: 960, requestOutcome: "SUCCESS", pageTemplate: "/onboarding/permissions", pageTitle: "权限说明" },
          { seq: 5, offsetMs: 356000, type: JourneyEventType.FEEDBACK, title: "进入工作台", description: "接入完成后跳转到工作台首页。", uiFeedback: "redirect.success", targetLabel: "工作台首页", pageTemplate: "/workspace", pageTitle: "工作台" },
        ],
        evidences: [
          { eventSeq: 3, type: EvidenceType.SCREENSHOT, title: "权限说明长停留关键帧", description: "用户在权限说明 FAQ 区域停留较久。", severity: EvidenceSeverity.INFO, offsetMs: 142000 },
          { eventSeq: 3, type: EvidenceType.DOM_SNAPSHOT, title: "权限文案快照", description: "首屏没有先概括授权收益与风险边界。", severity: EvidenceSeverity.WARNING, offsetMs: 143000 },
        ],
      },
      "J-240601-102": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入经营看板", description: "用户打开经营看板并准备导出月报。", pageUrl: "https://console.nebula-tech.com/reports", pageTemplate: "/reports", pageTitle: "经营看板", businessIntent: "导出月报" },
          { seq: 2, offsetMs: 25000, type: JourneyEventType.REGION_ACTION, title: "设置时间筛选", description: "用户切换到上月口径并选择月报模板。", region: "筛选工具栏", uiAction: "select", businessAction: "报表筛选", targetLabel: "上月月报", pageTemplate: "/reports", pageTitle: "经营看板" },
          { seq: 3, offsetMs: 71000, type: JourneyEventType.BUSINESS_ACTION, title: "点击导出", description: "用户点击导出按钮生成月报。", region: "顶部操作栏", uiAction: "click", businessAction: "报表导出", targetLabel: "导出月报", pageTemplate: "/reports", pageTitle: "经营看板" },
          { seq: 4, offsetMs: 126000, type: JourneyEventType.REQUEST, title: "导出任务超时失败", description: "导出任务请求返回 504，前端未成功拉起下载。", requestHost: "api.nebula-tech.com", method: "GET", pathTemplate: "/api/reports/export", statusCode: 504, durationMs: 3210, requestOutcome: "FAILED", pageTemplate: "/reports", pageTitle: "经营看板", isAnomaly: true },
          { seq: 5, offsetMs: 128000, type: JourneyEventType.FEEDBACK, title: "出现失败提示", description: "页面出现失败 toast，但没有补偿路径。", region: "全局提示层", uiFeedback: "toast.error", targetLabel: "导出失败，请稍后重试", pageTemplate: "/reports", pageTitle: "经营看板", isAnomaly: true },
          { seq: 6, offsetMs: 194000, type: JourneyEventType.EXIT, title: "用户离开页面", description: "用户未再次尝试导出，直接离开页面。", pageTemplate: "/reports", pageTitle: "经营看板", isAnomaly: true },
        ],
        evidences: [
          { eventSeq: 4, type: EvidenceType.NETWORK, title: "导出接口 504", description: "导出接口响应超时，无法生成文件。", severity: EvidenceSeverity.CRITICAL, offsetMs: 126000, content: "{ \"path\": \"/api/reports/export\", \"status\": 504, \"duration_ms\": 3210 }" },
          { eventSeq: 5, type: EvidenceType.TOAST, title: "导出失败 toast", description: "提示语过于笼统，没有告知是否会自动重试。", severity: EvidenceSeverity.WARNING, offsetMs: 128000, content: "导出失败，请稍后重试" },
        ],
      },
      "J-240601-103": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入企业版升级页", description: "用户从账单入口进入升级页面。", pageUrl: "https://console.nebula-tech.com/billing/upgrade", pageTemplate: "/billing/upgrade", pageTitle: "企业版升级", businessIntent: "升级企业版" },
          { seq: 2, offsetMs: 34000, type: JourneyEventType.REGION_ACTION, title: "查看版本权益", description: "用户展开版本权益对比，停留较久。", region: "版本对比表", uiAction: "expand_panel", businessAction: "权益查看", targetLabel: "高级版权益", pageTemplate: "/billing/upgrade", pageTitle: "企业版升级" },
          { seq: 3, offsetMs: 109000, type: JourneyEventType.BUSINESS_ACTION, title: "切换席位数量", description: "用户反复调整席位数量观察价格变化。", region: "席位配置器", uiAction: "change_stepper", businessAction: "席位调整", targetLabel: "20 席位", pageTemplate: "/billing/upgrade", pageTitle: "企业版升级" },
          { seq: 4, offsetMs: 173000, type: JourneyEventType.REQUEST, title: "价格重算成功", description: "价格重算返回成功，但页面缺少清晰解释。", requestHost: "api.nebula-tech.com", method: "POST", pathTemplate: "/api/billing/quote", statusCode: 200, durationMs: 1140, requestOutcome: "SUCCESS", pageTemplate: "/billing/upgrade", pageTitle: "企业版升级" },
          { seq: 5, offsetMs: 278000, type: JourneyEventType.EXIT, title: "放弃升级", description: "用户未点击提交升级，直接离开页面。", pageTemplate: "/billing/upgrade", pageTitle: "企业版升级" },
        ],
        evidences: [
          { eventSeq: 3, type: EvidenceType.SCREENSHOT, title: "席位调整关键帧", description: "用户反复切换席位数量，没有立刻形成决策。", severity: EvidenceSeverity.INFO, offsetMs: 111000 },
          { eventSeq: 4, type: EvidenceType.DOM_SNAPSHOT, title: "价格说明快照", description: "总价、折扣和席位价分散在多个区域。", severity: EvidenceSeverity.WARNING, offsetMs: 174000 },
        ],
      },
      "J-240601-104": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入认证文档", description: "用户打开 API 认证说明文档。", pageUrl: "https://help.nebula-tech.com/api/authentication", pageTemplate: "/docs/[slug]", pageTitle: "API 认证说明", businessIntent: "了解接入方式" },
          { seq: 2, offsetMs: 26000, type: JourneyEventType.REGION_ACTION, title: "查看错误码区域", description: "用户滚动到错误码与签名示例区域。", region: "错误码说明", uiAction: "scroll_into_view", businessAction: "文档浏览", targetLabel: "错误码", pageTemplate: "/docs/[slug]", pageTitle: "API 认证说明" },
          { seq: 3, offsetMs: 104000, type: JourneyEventType.EXIT, title: "退出文档站", description: "用户没有继续浏览示例或下载 SDK。", pageTemplate: "/docs/[slug]", pageTitle: "API 认证说明" },
        ],
        evidences: [
          { eventSeq: 2, type: EvidenceType.SCREENSHOT, title: "错误码区域关键帧", description: "用户停留在错误码区域后退出。", severity: EvidenceSeverity.INFO, offsetMs: 28000 },
        ],
      },
    },
  },
  {
    tenant: {
      id: "tnt_240601_002",
      name: "蓝海电商",
      slug: "blue-ocean-commerce",
      industry: "电商",
      plan: TenantPlan.GROWTH,
      status: TenantStatus.ACTIVE,
      description: "覆盖商品浏览、结算支付与营销活动的电商租户，适合演示 AI 对回放与异常证据的分析能力。",
    },
    applications: [
      {
        id: "app_240601_201",
        name: "BlueOcean Checkout",
        appKey: "blueocean_checkout_web",
        host: "checkout.blueocean.com",
        description: "核心结算与支付站点。",
        status: ApplicationStatus.ACTIVE,
        ingestToken: "igr_blueocean_checkout_9e2c6a1b7d",
        createdAt: daysAgo(32),
        updatedAt: daysAgo(1),
        lastReportedAt: minutesAgo(3),
      },
      {
        id: "app_240601_202",
        name: "BlueOcean Campaign",
        appKey: "blueocean_campaign_h5",
        host: "promo.blueocean.com",
        description: "营销活动页与商品详情浏览入口。",
        status: ApplicationStatus.ACTIVE,
        ingestToken: "igr_blueocean_campaign_4c1f8e0b2a",
        createdAt: daysAgo(26),
        updatedAt: daysAgo(2),
        lastReportedAt: hoursAgo(4),
      },
    ],
    tags: [
      { name: "高意向", type: TagType.USER, source: TagSource.RULE, color: "#dbeafe", description: "近 7 天多次进入结算链路。", applicationId: "app_240601_201" },
      { name: "价格敏感", type: TagType.USER, source: TagSource.MANUAL, color: "#ffedd5", description: "对运费、优惠与总价变化高度敏感。", applicationId: "app_240601_201" },
      { name: "异常关注", type: TagType.USER, source: TagSource.SYSTEM, color: "#fee2e2", description: "近期多次经历异常请求或错误反馈。", applicationId: "app_240601_201" },
      { name: "新用户", type: TagType.USER, source: TagSource.SYSTEM, color: "#dcfce7", description: "首次出现时间较近。", applicationId: "app_240601_202" },
      { name: "核心用户", type: TagType.USER, source: TagSource.MANUAL, color: "#ede9fe", description: "长期稳定使用产品。", applicationId: "app_240601_201" },
      { name: "支付失败", type: TagType.JOURNEY, source: TagSource.SYSTEM, color: "#fee2e2", description: "支付前后关键请求失败。", applicationId: "app_240601_201" },
      { name: "费用疑惑", type: TagType.JOURNEY, source: TagSource.MANUAL, color: "#ffedd5", description: "用户在费用明细、运费或应付总额处明显犹豫。", applicationId: "app_240601_201" },
      { name: "顺利完成", type: TagType.JOURNEY, source: TagSource.RULE, color: "#dcfce7", description: "标准健康路径样本。", applicationId: "app_240601_201" },
      { name: "长停滞犹豫", type: TagType.JOURNEY, source: TagSource.SYSTEM, color: "#fef3c7", description: "存在长停留或重复查看。", applicationId: "app_240601_201" },
      { name: "仅浏览退出", type: TagType.JOURNEY, source: TagSource.RULE, color: "#e2e8f0", description: "只完成浅层浏览后退出。", applicationId: "app_240601_202" },
      { name: "中途放弃", type: TagType.JOURNEY, source: TagSource.RULE, color: "#f1f5f9", description: "用户在完成核心任务前主动离开。", applicationId: "app_240601_201" },
      { name: "优惠券反馈不清", type: TagType.JOURNEY, source: TagSource.MANUAL, color: "#fde68a", description: "优惠已生效但界面反馈不明确。", applicationId: "app_240601_201" },
    ],
    users: [
      { id: "usr_240601_201", applicationId: "app_240601_201", externalId: "U-240601-201", name: "Mia Chen", email: "mia.chen@example.com", avatarSeed: "M", deviceType: "Desktop", os: "macOS 14.5", browser: "Chrome 126", location: "上海", firstSeenAt: daysAgo(28), lastActiveAt: minutesAgo(6), tags: ["高意向", "异常关注"] },
      { id: "usr_240601_202", applicationId: "app_240601_201", externalId: "U-240601-202", name: "Leo Xu", email: "leo.xu@example.com", avatarSeed: "L", deviceType: "Desktop", os: "Windows 11", browser: "Edge 126", location: "杭州", firstSeenAt: daysAgo(12), lastActiveAt: hoursAgo(3), tags: ["价格敏感", "新用户"] },
      { id: "usr_240601_203", applicationId: "app_240601_201", externalId: "U-240601-203", name: "Ada Lin", email: "ada.lin@example.com", avatarSeed: "A", deviceType: "Desktop", os: "macOS 14.5", browser: "Safari 17", location: "深圳", firstSeenAt: daysAgo(63), lastActiveAt: hoursAgo(9), tags: ["核心用户"] },
      { id: "usr_240601_204", applicationId: "app_240601_202", externalId: "U-240601-204", name: "Ethan Wu", email: "ethan.wu@example.com", avatarSeed: "E", deviceType: "Mobile Web", os: "iOS 17", browser: "Safari Mobile", location: "北京", firstSeenAt: daysAgo(7), lastActiveAt: hoursAgo(12), tags: ["新用户"] },
      { id: "usr_240601_205", applicationId: "app_240601_201", externalId: "U-240601-205", name: "Nora Gao", email: "nora.gao@example.com", avatarSeed: "N", deviceType: "Desktop", os: "Windows 11", browser: "Chrome 126", location: "广州", firstSeenAt: daysAgo(34), lastActiveAt: hoursAgo(4), tags: ["高意向", "价格敏感"] },
    ],
    journeys: [
      { id: "jny_240601_201", applicationId: "app_240601_201", userId: "usr_240601_201", journeyCode: "J-240601-201", title: "支付组件初始化失败导致结算中断", startedAt: hoursAgo(5), endedAt: new Date(hoursAgo(5).getTime() + 186000), totalDurationMs: 186000, effectiveDurationMs: 149000, pageCount: 4, keyActionCount: 9, requestCount: 6, resultStatus: JourneyResultStatus.FAILED, hasAnomaly: true, pageUrl: "https://checkout.blueocean.com/checkout", pageTemplate: "/checkout", pageTitle: "订单结算", businessActionType: "支付提交", aiSummaryShort: "用户已完成地址与优惠确认，但在提交支付时支付 SDK 初始化失败，错误 toast 出现后停滞 15 秒并退出。", aiScenarioSummary: "本次旅程处于高意向结算场景，用户目标明确，即完成支付并结束购买流程。", aiProcessSummary: "用户先确认地址和优惠券，再点击确认支付；支付初始化失败后没有可继续路径。", aiGoalAnalysis: "目标未达成，关键阻断点发生在支付组件初始化阶段。", aiAnomalyAnalysis: "存在明确技术异常：支付 SDK mount 失败，错误 toast 与失败请求证据完整。", createdAt: hoursAgo(5), tags: ["支付失败", "中途放弃"] },
      { id: "jny_240601_202", applicationId: "app_240601_201", userId: "usr_240601_202", journeyCode: "J-240601-202", title: "费用说明理解不清后返回购物车并放弃", startedAt: hoursAgo(8), endedAt: new Date(hoursAgo(8).getTime() + 324000), totalDurationMs: 324000, effectiveDurationMs: 219000, pageCount: 5, keyActionCount: 8, requestCount: 4, resultStatus: JourneyResultStatus.ABANDONED, hasAnomaly: false, pageUrl: "https://checkout.blueocean.com/checkout", pageTemplate: "/checkout", pageTitle: "订单结算", businessActionType: "费用确认", aiSummaryShort: "用户反复展开费用明细并返回购物车修改商品数量，第二次进入结算页后仍停留较久，最终未提交支付。", aiScenarioSummary: "本次旅程属于价格敏感型结算确认，用户核心诉求是理解订单总价为何变化。", aiProcessSummary: "用户两次打开费用明细，一次回退购物车修改商品，再次进入后长时间停留在应付总额区域并关闭页面。", aiGoalAnalysis: "目标未达成，阻塞发生在费用理解与信任建立环节。", aiAnomalyAnalysis: "没有技术报错，但存在长停留、重复展开说明和路径回退。", createdAt: hoursAgo(8), tags: ["费用疑惑", "中途放弃", "长停滞犹豫"] },
      { id: "jny_240601_203", applicationId: "app_240601_201", userId: "usr_240601_203", journeyCode: "J-240601-203", title: "标准结算路径顺利完成支付", startedAt: hoursAgo(18), endedAt: new Date(hoursAgo(18).getTime() + 164000), totalDurationMs: 164000, effectiveDurationMs: 149000, pageCount: 4, keyActionCount: 10, requestCount: 5, resultStatus: JourneyResultStatus.COMPLETED, hasAnomaly: false, pageUrl: "https://checkout.blueocean.com/checkout", pageTemplate: "/checkout", pageTitle: "订单结算", businessActionType: "支付提交", aiSummaryShort: "用户快速完成地址确认、优惠券选择与支付提交，支付回调成功，整个流程没有回退与异常。", aiScenarioSummary: "这是典型的高明确度购买场景，可作为健康基准路径对照样本。", aiProcessSummary: "用户从购物车进入结算页后连续完成确认动作，支付请求一次成功，并跳转到支付成功页。", aiGoalAnalysis: "目标已达成，说明核心转化链路在该样本中表现健康。", aiAnomalyAnalysis: "未发现异常请求、错误反馈或明显的负向停滞信号。", createdAt: hoursAgo(18), tags: ["顺利完成"] },
      { id: "jny_240601_204", applicationId: "app_240601_201", userId: "usr_240601_203", journeyCode: "J-240601-204", title: "权限说明区域长停滞后完成新手引导", startedAt: daysAgo(1), endedAt: new Date(daysAgo(1).getTime() + 412000), totalDurationMs: 412000, effectiveDurationMs: 238000, pageCount: 6, keyActionCount: 12, requestCount: 4, resultStatus: JourneyResultStatus.COMPLETED, hasAnomaly: false, pageUrl: "https://checkout.blueocean.com/onboarding", pageTemplate: "/onboarding", pageTitle: "新手引导", businessActionType: "初始化配置", aiSummaryShort: "用户在权限说明页停留 2 分 40 秒并多次展开解释文案，最终仍完成配置流程。", aiScenarioSummary: "用户目标是首次完成账户初始化并进入工作台。", aiProcessSummary: "组织信息和通知配置都较顺畅，停滞点出现在权限说明区域。", aiGoalAnalysis: "目标已达成，但权限解释成本偏高，完成效率仍有明显优化空间。", aiAnomalyAnalysis: "没有技术异常，不过存在显著犹豫行为。", createdAt: daysAgo(1), tags: ["顺利完成", "长停滞犹豫"] },
      { id: "jny_240601_205", applicationId: "app_240601_202", userId: "usr_240601_204", journeyCode: "J-240601-205", title: "浏览商品详情与评价后直接退出", startedAt: daysAgo(2), endedAt: new Date(daysAgo(2).getTime() + 98000), totalDurationMs: 98000, effectiveDurationMs: 73000, pageCount: 3, keyActionCount: 4, requestCount: 2, resultStatus: JourneyResultStatus.BROWSING, hasAnomaly: false, pageUrl: "https://promo.blueocean.com/products/insights-pro", pageTemplate: "/products/[slug]", pageTitle: "Insight Pro 商品详情", businessActionType: "商品浏览", aiSummaryShort: "用户停留在商品详情和评价区域，没有加入购物车或点击试用，浏览后直接离开。", aiScenarioSummary: "本次旅程偏向前期信息收集，用户尚未形成明确转化意图。", aiProcessSummary: "用户先浏览产品卖点，再查看价格和评价模块，没有触发深层业务动作。", aiGoalAnalysis: "没有证据表明用户已进入核心转化链路。", aiAnomalyAnalysis: "未发现异常，该样本适合研究首屏吸引力。", createdAt: daysAgo(2), tags: ["仅浏览退出"] },
      { id: "jny_240601_206", applicationId: "app_240601_201", userId: "usr_240601_205", journeyCode: "J-240601-206", title: "优惠券状态反馈不清导致放弃支付", startedAt: hoursAgo(4), endedAt: new Date(hoursAgo(4).getTime() + 286000), totalDurationMs: 286000, effectiveDurationMs: 214000, pageCount: 4, keyActionCount: 7, requestCount: 5, resultStatus: JourneyResultStatus.ABANDONED, hasAnomaly: false, pageUrl: "https://checkout.blueocean.com/checkout", pageTemplate: "/checkout", pageTitle: "订单结算", businessActionType: "优惠券确认", aiSummaryShort: "用户两次切换优惠券，校验请求虽返回成功，但页面没有清晰提示优惠是否生效，最终放弃支付。", aiScenarioSummary: "本次旅程发生在高意向结算确认场景，用户目标是确认优惠是否正确生效后完成付款。", aiProcessSummary: "用户先打开优惠券抽屉选择满减券，看到金额变化后仍不确定是否叠加成功，于是再次切换优惠券并回看总价。", aiGoalAnalysis: "目标未达成，阻断点在优惠生效反馈与总价解释不够明确。", aiAnomalyAnalysis: "没有系统级异常，但存在典型的交互反馈缺失。", createdAt: hoursAgo(4), tags: ["优惠券反馈不清", "中途放弃", "长停滞犹豫"] },
    ],
    projects: [
      {
        id: "prj_240601_201",
        applicationId: "app_240601_201",
        projectCode: "P-240601-201",
        name: "新版结算页可用性验证",
        goal: "验证新版结算页是否能让用户快速理解价格构成并顺利完成支付，定位费用理解与支付提交环节的阻断点。",
        focusArea: "结算与支付体验",
        focusTarget: "高意向下单用户",
        focusFeature: "结算页 / 支付提交",
        ownerName: "林晓雯",
        description: "关注费用说明、优惠券反馈、支付提交稳定性三类问题，沉淀可解释的证据链。",
        filterTimeRangeLabel: "近 7 天高意向结算旅程",
        filterPageTemplates: "/checkout, /payment",
        filterStatuses: "已完成, 中途放弃, 异常失败",
        filterTagRules: "支付失败, 费用疑惑, 优惠券反馈不清, 长停滞犹豫",
        createdAt: daysAgo(4),
        journeyCodes: ["J-240601-201", "J-240601-202", "J-240601-203", "J-240601-206"],
        findings: [
          { title: "费用解释区是中途放弃的主要认知阻塞点", summary: "用户在应付总额、运费和优惠明细区域反复展开说明，且经常伴随回退购物车。", category: FindingCategory.INSIGHT, evidenceJourneyCount: 3, sortOrder: 1 },
          { title: "支付初始化异常会直接击穿高意向用户的完成路径", summary: "异常样本显示用户已完成全部前置动作，但支付 SDK 初始化失败后没有可恢复路径。", category: FindingCategory.TECHNICAL, evidenceJourneyCount: 1, sortOrder: 2 },
        ],
      },
      {
        id: "prj_240601_202",
        applicationId: "app_240601_201",
        projectCode: "P-240601-202",
        name: "新手引导理解成本观察",
        goal: "观察首次使用者在初始化配置过程中的理解阻塞，重点确认权限与说明文案是否造成额外学习成本。",
        focusArea: "Onboarding 转化",
        focusTarget: "新用户",
        focusFeature: "Onboarding / 权限说明",
        ownerName: "周亦凡",
        description: "收集新手引导的顺利完成样本与长停留样本，把完成与完成成本分开看。",
        filterTimeRangeLabel: "近 14 天首次配置旅程",
        filterPageTemplates: "/onboarding, /workspace",
        filterStatuses: "已完成",
        filterTagRules: "长停滞犹豫, 顺利完成",
        createdAt: daysAgo(7),
        journeyCodes: ["J-240601-204"],
        findings: [
          { title: "权限说明不会直接导致失败，但会显著提高完成成本", summary: "样本最终完成，但权限说明区域的长停留明显拉长了总时长。", category: FindingCategory.INTERACTION, evidenceJourneyCount: 1, sortOrder: 1 },
        ],
      },
    ],
    integrationLogs: [
      { applicationId: "app_240601_201", level: "info", status: "已接收", source: "collector.browser", message: "page_view 事件已入库，页面模板识别成功", payloadSummary: "/checkout · page_title=订单结算", createdAt: minutesAgo(3) },
      { applicationId: "app_240601_201", level: "info", status: "已聚合", source: "journey-builder", message: "旅程 J-240601-201 已完成事件聚合与 AI 摘要匹配", payloadSummary: "events=8 · evidences=4", createdAt: minutesAgo(4) },
      { applicationId: "app_240601_201", level: "error", status: "异常", source: "sdk.runtime", message: "支付 SDK 上报初始化错误", payloadSummary: "TypeError: Cannot read properties of undefined (reading 'mount')", createdAt: minutesAgo(7) },
      { applicationId: "app_240601_202", level: "info", status: "已校验", source: "validator", message: "营销页最近 24 小时活跃用户校验完成", payloadSummary: "journeys=2 · active_users=1", createdAt: hoursAgo(4) },
    ],
    stories: {
      "J-240601-201": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入结算页", description: "用户从购物车进入结算页。", pageUrl: "https://checkout.blueocean.com/checkout", pageTemplate: "/checkout", pageTitle: "订单结算", businessIntent: "完成支付" },
          { seq: 2, offsetMs: 12000, type: JourneyEventType.REGION_ACTION, title: "确认收货地址", description: "用户确认默认收货地址。", region: "地址信息卡片", uiAction: "expand_card", businessAction: "地址确认", targetLabel: "默认地址", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 3, offsetMs: 47000, type: JourneyEventType.BUSINESS_ACTION, title: "尝试使用优惠券", description: "用户打开优惠券抽屉并选择一张满减券。", region: "优惠券区域", uiAction: "select_coupon", businessAction: "优惠券选择", targetLabel: "满减券", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 4, offsetMs: 62000, type: JourneyEventType.REQUEST, title: "优惠券校验完成", description: "优惠券校验请求返回成功。", requestHost: "api.blueocean.com", method: "POST", pathTemplate: "/api/checkout/coupon/validate", statusCode: 200, durationMs: 820, requestOutcome: "SUCCESS", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 5, offsetMs: 104000, type: JourneyEventType.BUSINESS_ACTION, title: "点击确认支付", description: "用户确认总价后点击确认支付。", region: "底部支付栏", uiAction: "click", businessAction: "支付提交", targetLabel: "确认支付", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 6, offsetMs: 109000, type: JourneyEventType.REQUEST, title: "支付 SDK 初始化失败", description: "支付组件初始化请求返回 500。", requestHost: "pay.blueocean.com", method: "POST", pathTemplate: "/sdk/payment/init", statusCode: 500, durationMs: 1420, requestOutcome: "FAILED", pageTemplate: "/checkout", pageTitle: "订单结算", isAnomaly: true },
          { seq: 7, offsetMs: 111000, type: JourneyEventType.FEEDBACK, title: "页面弹出错误 toast", description: "支付按钮区域出现错误提示。", region: "全局提示层", uiFeedback: "toast.error", targetLabel: "支付组件加载失败，请稍后重试", pageTemplate: "/checkout", pageTitle: "订单结算", isAnomaly: true },
          { seq: 8, offsetMs: 186000, type: JourneyEventType.EXIT, title: "用户离开结算页", description: "错误提示后停留 15 秒后退出。", pageTemplate: "/checkout", pageTitle: "订单结算", isAnomaly: true },
        ],
        evidences: [
          { eventSeq: 6, type: EvidenceType.NETWORK, title: "支付初始化请求失败", description: "支付初始化请求返回 500。", severity: EvidenceSeverity.CRITICAL, offsetMs: 109000, content: "{ \"path\": \"/sdk/payment/init\", \"status\": 500 }" },
          { eventSeq: 7, type: EvidenceType.TOAST, title: "错误 toast 文案", description: "错误提示没有给出可恢复动作。", severity: EvidenceSeverity.WARNING, offsetMs: 111000, content: "支付组件加载失败，请稍后重试" },
        ],
      },
      "J-240601-202": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "首次进入结算页", description: "用户从购物车进入结算页，首先查看金额构成。", pageUrl: "https://checkout.blueocean.com/checkout", pageTemplate: "/checkout", pageTitle: "订单结算", businessIntent: "确认费用后下单" },
          { seq: 2, offsetMs: 18000, type: JourneyEventType.REGION_ACTION, title: "展开费用明细", description: "用户查看运费与优惠抵扣组成。", region: "费用明细抽屉", uiAction: "expand_panel", businessAction: "费用确认", targetLabel: "明细展开", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 3, offsetMs: 56000, type: JourneyEventType.REQUEST, title: "运费重算完成", description: "切换配送方式后，运费重算请求成功但耗时偏长。", requestHost: "api.blueocean.com", method: "POST", pathTemplate: "/api/checkout/shipping/calc", statusCode: 200, durationMs: 2380, requestOutcome: "SUCCESS", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 4, offsetMs: 103000, type: JourneyEventType.STATE_CHANGE, title: "返回购物车修改商品", description: "用户返回购物车，减少商品数量后重新进入结算页。", businessAction: "商品调整", businessIntent: "降低订单总价", pageTemplate: "/cart", pageTitle: "购物车" },
          { seq: 5, offsetMs: 221000, type: JourneyEventType.REGION_ACTION, title: "再次展开费用明细", description: "用户第二次展开费用说明。", region: "费用明细抽屉", uiAction: "expand_panel", businessAction: "费用确认", targetLabel: "运费明细", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 6, offsetMs: 324000, type: JourneyEventType.EXIT, title: "用户关闭页面", description: "长时间停留后没有继续支付。", pageTemplate: "/checkout", pageTitle: "订单结算" },
        ],
        evidences: [
          { eventSeq: 3, type: EvidenceType.NETWORK, title: "运费重算请求耗时偏长", description: "2.38 秒的响应放大了等待感。", severity: EvidenceSeverity.WARNING, offsetMs: 56000, content: "{ \"path\": \"/api/checkout/shipping/calc\", \"status\": 200, \"duration_ms\": 2380 }" },
          { eventSeq: 5, type: EvidenceType.DOM_SNAPSHOT, title: "费用说明区域快照", description: "应付总额、运费与优惠金额被分散在不同块中。", severity: EvidenceSeverity.INFO, offsetMs: 221000 },
        ],
      },
      "J-240601-203": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入结算页", description: "用户直接进入结算页。", pageUrl: "https://checkout.blueocean.com/checkout", pageTemplate: "/checkout", pageTitle: "订单结算", businessIntent: "完成支付" },
          { seq: 2, offsetMs: 14000, type: JourneyEventType.REGION_ACTION, title: "确认地址与配送", description: "用户快速确认默认地址与配送方式。", region: "地址与配送信息", uiAction: "confirm", businessAction: "地址确认", targetLabel: "默认地址", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 3, offsetMs: 41000, type: JourneyEventType.BUSINESS_ACTION, title: "选择优惠券", description: "用户选中一张可用优惠券。", region: "优惠券抽屉", uiAction: "select_coupon", businessAction: "优惠券选择", targetLabel: "立减券", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 4, offsetMs: 72000, type: JourneyEventType.REQUEST, title: "创建支付订单", description: "支付订单创建成功。", requestHost: "api.blueocean.com", method: "POST", pathTemplate: "/api/checkout/pay-order", statusCode: 200, durationMs: 760, requestOutcome: "SUCCESS", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 5, offsetMs: 93000, type: JourneyEventType.BUSINESS_ACTION, title: "点击确认支付", description: "用户发起支付。", region: "底部支付栏", uiAction: "click", businessAction: "支付提交", targetLabel: "确认支付", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 6, offsetMs: 122000, type: JourneyEventType.FEEDBACK, title: "支付成功反馈", description: "用户收到支付成功状态并跳转到成功页。", uiFeedback: "success_state", targetLabel: "支付成功", pageTemplate: "/payment-success", pageTitle: "支付成功" },
        ],
        evidences: [
          { eventSeq: 4, type: EvidenceType.NETWORK, title: "支付订单请求成功", description: "关键支付请求稳定返回 200。", severity: EvidenceSeverity.INFO, offsetMs: 72000, content: "{ \"path\": \"/api/checkout/pay-order\", \"status\": 200 }" },
        ],
      },
      "J-240601-204": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入新手引导", description: "用户第一次进入引导流程。", pageUrl: "https://checkout.blueocean.com/onboarding", pageTemplate: "/onboarding", pageTitle: "新手引导", businessIntent: "完成初始化配置" },
          { seq: 2, offsetMs: 36000, type: JourneyEventType.BUSINESS_ACTION, title: "填写组织信息", description: "组织信息填写顺利完成。", region: "组织信息表单", uiAction: "submit", businessAction: "组织配置", targetLabel: "下一步", pageTemplate: "/onboarding", pageTitle: "新手引导" },
          { seq: 3, offsetMs: 87000, type: JourneyEventType.PAGE_VIEW, title: "进入权限说明步骤", description: "用户进入权限说明页。", pageTemplate: "/onboarding/permissions", pageTitle: "权限说明" },
          { seq: 4, offsetMs: 248000, type: JourneyEventType.REGION_ACTION, title: "多次展开权限解释", description: "用户多次展开 FAQ 与授权说明。", region: "权限说明 FAQ", uiAction: "expand_panel", businessAction: "权限确认", targetLabel: "查看详细解释", pageTemplate: "/onboarding/permissions", pageTitle: "权限说明" },
          { seq: 5, offsetMs: 301000, type: JourneyEventType.REQUEST, title: "权限配置保存成功", description: "权限配置请求成功。", requestHost: "api.blueocean.com", method: "POST", pathTemplate: "/api/onboarding/permissions", statusCode: 200, durationMs: 940, requestOutcome: "SUCCESS", pageTemplate: "/onboarding/permissions", pageTitle: "权限说明" },
          { seq: 6, offsetMs: 412000, type: JourneyEventType.FEEDBACK, title: "进入工作台首页", description: "引导完成，系统跳转至工作台首页。", uiFeedback: "redirect.success", targetLabel: "工作台首页", pageTemplate: "/workspace", pageTitle: "工作台" },
        ],
        evidences: [
          { eventSeq: 4, type: EvidenceType.SCREENSHOT, title: "权限说明长停留关键帧", description: "用户停留在权限解释区域。", severity: EvidenceSeverity.INFO, offsetMs: 248000 },
        ],
      },
      "J-240601-205": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入商品详情页", description: "用户进入商品详情页。", pageUrl: "https://promo.blueocean.com/products/insights-pro", pageTemplate: "/products/[slug]", pageTitle: "Insight Pro 商品详情", businessIntent: "了解产品能力" },
          { seq: 2, offsetMs: 24000, type: JourneyEventType.REGION_ACTION, title: "查看价格模块", description: "用户滚动到价格与套餐区域。", region: "价格套餐区", uiAction: "scroll_into_view", businessAction: "商品浏览", targetLabel: "价格套餐", pageTemplate: "/products/[slug]", pageTitle: "Insight Pro 商品详情" },
          { seq: 3, offsetMs: 54000, type: JourneyEventType.PAGE_VIEW, title: "切换到评价区域", description: "用户继续浏览用户评价与案例模块。", pageTemplate: "/products/[slug]", pageTitle: "Insight Pro 商品详情", region: "用户评价" },
          { seq: 4, offsetMs: 98000, type: JourneyEventType.EXIT, title: "用户离开商品详情页", description: "用户没有触发转化动作，直接离开。", pageTemplate: "/products/[slug]", pageTitle: "Insight Pro 商品详情" },
        ],
        evidences: [
          { eventSeq: 2, type: EvidenceType.SCREENSHOT, title: "价格模块浏览关键帧", description: "用户浏览价格信息，但未触发任何转化动作。", severity: EvidenceSeverity.INFO, offsetMs: 24000 },
        ],
      },
      "J-240601-206": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入结算页", description: "用户返回结算页准备确认优惠。", pageUrl: "https://checkout.blueocean.com/checkout", pageTemplate: "/checkout", pageTitle: "订单结算", businessIntent: "确认优惠后付款" },
          { seq: 2, offsetMs: 28000, type: JourneyEventType.REGION_ACTION, title: "打开优惠券抽屉", description: "用户查看当前可用券与抵扣规则。", region: "优惠券抽屉", uiAction: "expand_panel", businessAction: "优惠券确认", targetLabel: "可用优惠券", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 3, offsetMs: 61000, type: JourneyEventType.BUSINESS_ACTION, title: "选择第一张满减券", description: "用户尝试选择一张满减券。", region: "优惠券列表", uiAction: "select_coupon", businessAction: "优惠券选择", targetLabel: "满减券 A", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 4, offsetMs: 79000, type: JourneyEventType.REQUEST, title: "优惠券校验请求成功", description: "请求返回成功，但页面没有明确成功提示。", requestHost: "api.blueocean.com", method: "POST", pathTemplate: "/api/checkout/coupon/validate", statusCode: 200, durationMs: 910, requestOutcome: "SUCCESS", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 5, offsetMs: 141000, type: JourneyEventType.BUSINESS_ACTION, title: "再次切换优惠券", description: "用户因为不确定上一张券是否生效，再次切换到另一张券。", region: "优惠券列表", uiAction: "select_coupon", businessAction: "优惠券选择", targetLabel: "折扣券 B", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 6, offsetMs: 165000, type: JourneyEventType.REQUEST, title: "第二次优惠券校验成功", description: "第二次校验同样返回成功。", requestHost: "api.blueocean.com", method: "POST", pathTemplate: "/api/checkout/coupon/validate", statusCode: 200, durationMs: 860, requestOutcome: "SUCCESS", pageTemplate: "/checkout", pageTitle: "订单结算" },
          { seq: 7, offsetMs: 286000, type: JourneyEventType.EXIT, title: "放弃支付并退出", description: "用户反复对照总价后仍未点击支付。", pageTemplate: "/checkout", pageTitle: "订单结算" },
        ],
        evidences: [
          { eventSeq: 4, type: EvidenceType.DOM_SNAPSHOT, title: "优惠生效反馈较弱的界面快照", description: "页面只在角落更新金额，没有醒目的“优惠已生效”反馈。", severity: EvidenceSeverity.WARNING, offsetMs: 80000 },
          { eventSeq: 5, type: EvidenceType.SCREENSHOT, title: "重复切换优惠券关键帧", description: "用户再次选择优惠券并停留在总价区域。", severity: EvidenceSeverity.INFO, offsetMs: 145000 },
        ],
      },
    },
  },
  {
    tenant: {
      id: "tnt_240601_003",
      name: "北极教育",
      slug: "polar-education",
      industry: "教育",
      plan: TenantPlan.STARTER,
      status: TenantStatus.TRIAL,
      description: "覆盖试听预约、课程报名和课堂作业的教育租户，适合演示报名失败、学习犹豫与浏览退出样本。",
    },
    applications: [
      {
        id: "app_240601_301",
        name: "Polar Classroom",
        appKey: "polar_classroom_web",
        host: "classroom.polar-edu.com",
        description: "课堂与作业工作台。",
        status: ApplicationStatus.ACTIVE,
        ingestToken: "igr_polar_classroom_6d7a2c9e4b",
        createdAt: daysAgo(21),
        updatedAt: daysAgo(1),
        lastReportedAt: minutesAgo(12),
      },
      {
        id: "app_240601_302",
        name: "Polar Enroll",
        appKey: "polar_enroll_h5",
        host: "enroll.polar-edu.com",
        description: "试听预约与课程报名 H5。",
        status: ApplicationStatus.ACTIVE,
        ingestToken: "igr_polar_enroll_8b5f0d3c9a",
        createdAt: daysAgo(19),
        updatedAt: daysAgo(1),
        lastReportedAt: hoursAgo(5),
      },
    ],
    tags: [
      { name: "高意向家长", type: TagType.USER, source: TagSource.RULE, color: "#dbeafe", description: "多次浏览课程与试听预约信息。", applicationId: "app_240601_302" },
      { name: "老师角色", type: TagType.USER, source: TagSource.SYSTEM, color: "#e0f2fe", description: "以课堂、作业和学情查看为主。", applicationId: "app_240601_301" },
      { name: "新线索", type: TagType.USER, source: TagSource.SYSTEM, color: "#dcfce7", description: "首次出现时间较近。", applicationId: "app_240601_302" },
      { name: "试听完成", type: TagType.JOURNEY, source: TagSource.RULE, color: "#dcfce7", description: "顺利完成试听预约。", applicationId: "app_240601_302" },
      { name: "报名失败", type: TagType.JOURNEY, source: TagSource.SYSTEM, color: "#fee2e2", description: "报名或支付过程被系统异常阻断。", applicationId: "app_240601_302" },
      { name: "作业犹豫", type: TagType.JOURNEY, source: TagSource.MANUAL, color: "#fde68a", description: "在作业提交或课堂反馈区长时间停留。", applicationId: "app_240601_301" },
      { name: "仅浏览退出", type: TagType.JOURNEY, source: TagSource.RULE, color: "#e2e8f0", description: "只浏览课程介绍后退出。", applicationId: "app_240601_302" },
      { name: "长停滞犹豫", type: TagType.JOURNEY, source: TagSource.SYSTEM, color: "#fef3c7", description: "存在长停留或重复阅读。", applicationId: "app_240601_301" },
    ],
    users: [
      { id: "usr_240601_301", applicationId: "app_240601_302", externalId: "U-240601-301", name: "Luna He", email: "luna.he@polar-edu.com", avatarSeed: "L", deviceType: "Mobile Web", os: "iOS 17", browser: "Safari Mobile", location: "成都", firstSeenAt: daysAgo(9), lastActiveAt: hoursAgo(2), tags: ["高意向家长", "新线索"] },
      { id: "usr_240601_302", applicationId: "app_240601_302", externalId: "U-240601-302", name: "Morris Hu", email: "morris.hu@polar-edu.com", avatarSeed: "M", deviceType: "Desktop", os: "Windows 11", browser: "Chrome 126", location: "武汉", firstSeenAt: daysAgo(15), lastActiveAt: hoursAgo(5), tags: ["高意向家长"] },
      { id: "usr_240601_303", applicationId: "app_240601_301", externalId: "U-240601-303", name: "Yvonne Li", email: "yvonne.li@polar-edu.com", avatarSeed: "Y", deviceType: "Desktop", os: "macOS 14.5", browser: "Chrome 126", location: "北京", firstSeenAt: daysAgo(42), lastActiveAt: hoursAgo(10), tags: ["老师角色"] },
    ],
    journeys: [
      { id: "jny_240601_301", applicationId: "app_240601_302", userId: "usr_240601_301", journeyCode: "J-240601-301", title: "试听预约顺利完成", startedAt: hoursAgo(9), endedAt: new Date(hoursAgo(9).getTime() + 152000), totalDurationMs: 152000, effectiveDurationMs: 119000, pageCount: 4, keyActionCount: 8, requestCount: 3, resultStatus: JourneyResultStatus.COMPLETED, hasAnomaly: false, pageUrl: "https://enroll.polar-edu.com/trial", pageTemplate: "/trial", pageTitle: "试听预约", businessActionType: "试听预约", aiSummaryShort: "家长快速完成试听班级选择、学员信息填写与时间确认，顺利提交预约。", aiScenarioSummary: "这是典型的高意向试听预约场景，用户目标明确，即尽快完成预约。", aiProcessSummary: "用户先浏览班级列表，再填写学员信息和联系方式，最后确认时间并提交。", aiGoalAnalysis: "目标已达成，路径连续且没有明显阻塞。", aiAnomalyAnalysis: "未发现异常，该样本可作为健康基准路径与异常样本对照。", createdAt: hoursAgo(9), tags: ["试听完成"] },
      { id: "jny_240601_302", applicationId: "app_240601_302", userId: "usr_240601_302", journeyCode: "J-240601-302", title: "课程报名支付验证失败", startedAt: hoursAgo(5), endedAt: new Date(hoursAgo(5).getTime() + 203000), totalDurationMs: 203000, effectiveDurationMs: 151000, pageCount: 4, keyActionCount: 7, requestCount: 5, resultStatus: JourneyResultStatus.FAILED, hasAnomaly: true, pageUrl: "https://enroll.polar-edu.com/enroll", pageTemplate: "/enroll", pageTitle: "课程报名", businessActionType: "报名支付", aiSummaryShort: "家长完成课程与学员信息确认后发起支付，但验证码校验请求失败，最终无法完成报名。", aiScenarioSummary: "本次旅程位于课程报名末端，用户已有明确支付意图，失败会直接影响转化。", aiProcessSummary: "用户先确认课程和学员信息，再输入验证码并发起支付；验证码校验失败后页面只给出错误提示。", aiGoalAnalysis: "目标未达成，阻断点是验证码校验失败以及错误恢复能力不足。", aiAnomalyAnalysis: "存在明确技术异常：验证码校验请求返回 500，并伴随错误 toast。", createdAt: hoursAgo(5), tags: ["报名失败"] },
      { id: "jny_240601_303", applicationId: "app_240601_302", userId: "usr_240601_301", journeyCode: "J-240601-303", title: "浏览课程大纲后退出", startedAt: daysAgo(1), endedAt: new Date(daysAgo(1).getTime() + 94000), totalDurationMs: 94000, effectiveDurationMs: 68000, pageCount: 3, keyActionCount: 4, requestCount: 2, resultStatus: JourneyResultStatus.BROWSING, hasAnomaly: false, pageUrl: "https://enroll.polar-edu.com/course/reading", pageTemplate: "/course/[slug]", pageTitle: "课程介绍", businessActionType: "课程浏览", aiSummaryShort: "家长浏览课程亮点、师资介绍与班型信息后离开，没有进入试听或报名动作。", aiScenarioSummary: "该样本处于前期信息收集阶段，用户尚未明确进入试听或报名链路。", aiProcessSummary: "用户先浏览课程亮点，再查看师资和课程大纲，没有触发更深层动作。", aiGoalAnalysis: "没有证据表明用户已进入强转化状态，但可确认当前首屏内容未驱动下一步动作。", aiAnomalyAnalysis: "未发现异常，适合研究课程页的转化入口吸引力。", createdAt: daysAgo(1), tags: ["仅浏览退出"] },
      { id: "jny_240601_304", applicationId: "app_240601_301", userId: "usr_240601_303", journeyCode: "J-240601-304", title: "作业提交前长时间犹豫后完成", startedAt: hoursAgo(16), endedAt: new Date(hoursAgo(16).getTime() + 288000), totalDurationMs: 288000, effectiveDurationMs: 201000, pageCount: 5, keyActionCount: 9, requestCount: 3, resultStatus: JourneyResultStatus.COMPLETED, hasAnomaly: false, pageUrl: "https://classroom.polar-edu.com/homework/submit", pageTemplate: "/homework/submit", pageTitle: "作业提交", businessActionType: "作业提交", aiSummaryShort: "老师在作业反馈和评分说明区域停留较久，但最终仍完成作业提交。", aiScenarioSummary: "这是课堂交付场景，老师目标是完成作业批注与提交。", aiProcessSummary: "老师先上传批注与评分，随后在评分说明区域反复查看示例，最终继续提交。", aiGoalAnalysis: "目标已达成，但评分说明增加了理解成本。", aiAnomalyAnalysis: "没有技术异常，但存在明显的阅读犹豫与长停留。", createdAt: hoursAgo(16), tags: ["作业犹豫", "长停滞犹豫"] },
    ],
    projects: [
      {
        id: "prj_240601_301",
        applicationId: "app_240601_302",
        projectCode: "P-240601-301",
        name: "试听预约转化观察",
        goal: "评估试听预约链路是否足够顺畅，确认课程介绍页到预约页之间的转化阻塞点。",
        focusArea: "线索转化",
        focusTarget: "家长线索",
        focusFeature: "课程页 / 试听预约",
        ownerName: "宋知夏",
        description: "同时观察顺利完成样本与仅浏览退出样本，比较课程页内容与预约页阻塞。 ",
        filterTimeRangeLabel: "近 14 天试听与课程浏览旅程",
        filterPageTemplates: "/trial, /course/[slug]",
        filterStatuses: "已完成, 仅浏览退出",
        filterTagRules: "试听完成, 仅浏览退出",
        createdAt: daysAgo(6),
        journeyCodes: ["J-240601-301", "J-240601-303"],
        findings: [
          { title: "课程页缺少强引导的下一步动作", summary: "浏览样本说明家长虽然愿意看大纲与师资，但没有被明确引导进入试听预约。", category: FindingCategory.INSIGHT, evidenceJourneyCount: 1, sortOrder: 1 },
        ],
      },
      {
        id: "prj_240601_302",
        applicationId: "app_240601_301",
        projectCode: "P-240601-302",
        name: "报名失败与课堂交付体验研究",
        goal: "定位报名支付失败的系统风险，同时观察课堂交付场景中的理解成本问题。",
        focusArea: "支付与课堂体验",
        focusTarget: "报名家长 / 课堂老师",
        focusFeature: "报名支付 / 作业提交",
        ownerName: "韩柯",
        description: "把报名失败样本与课堂长停留样本放在一个项目里，兼顾技术稳定性与交互解释成本。",
        filterTimeRangeLabel: "近 30 天报名与作业旅程",
        filterPageTemplates: "/enroll, /homework/submit",
        filterStatuses: "异常失败, 已完成",
        filterTagRules: "报名失败, 作业犹豫, 长停滞犹豫",
        createdAt: daysAgo(10),
        journeyCodes: ["J-240601-302", "J-240601-304"],
        findings: [
          { title: "验证码失败会直接击穿报名转化", summary: "支付意图已经形成，但验证码校验失败后页面没有提供继续报名的可恢复路径。", category: FindingCategory.TECHNICAL, evidenceJourneyCount: 1, sortOrder: 1 },
          { title: "评分说明增加课堂交付成本", summary: "老师最终完成作业提交，但评分说明区域的长停留值得单独优化。", category: FindingCategory.INTERACTION, evidenceJourneyCount: 1, sortOrder: 2 },
        ],
      },
    ],
    integrationLogs: [
      { applicationId: "app_240601_302", level: "info", status: "已接收", source: "collector.browser", message: "试听预约 page_view 已入库", payloadSummary: "/trial · page_title=试听预约", createdAt: minutesAgo(12) },
      { applicationId: "app_240601_302", level: "error", status: "异常", source: "api.enroll", message: "验证码校验接口返回 500", payloadSummary: "POST /api/enroll/verify-code -> 500", createdAt: hoursAgo(5) },
      { applicationId: "app_240601_301", level: "info", status: "已校验", source: "validator", message: "课堂作业提交链路模板识别通过", payloadSummary: "/homework/submit", createdAt: hoursAgo(10) },
    ],
    stories: {
      "J-240601-301": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入试听预约页", description: "家长从课程页进入试听预约。", pageUrl: "https://enroll.polar-edu.com/trial", pageTemplate: "/trial", pageTitle: "试听预约", businessIntent: "预约试听" },
          { seq: 2, offsetMs: 22000, type: JourneyEventType.REGION_ACTION, title: "选择班级与时段", description: "用户选择目标班级与上课时段。", region: "班级选择器", uiAction: "select", businessAction: "班级确认", targetLabel: "少儿英语试听班", pageTemplate: "/trial", pageTitle: "试听预约" },
          { seq: 3, offsetMs: 69000, type: JourneyEventType.BUSINESS_ACTION, title: "填写学员信息", description: "用户完成学员姓名与联系方式填写。", region: "预约表单", uiAction: "submit", businessAction: "信息填写", targetLabel: "提交预约", pageTemplate: "/trial", pageTitle: "试听预约" },
          { seq: 4, offsetMs: 118000, type: JourneyEventType.REQUEST, title: "预约提交成功", description: "试听预约请求返回成功。", requestHost: "api.polar-edu.com", method: "POST", pathTemplate: "/api/trial/booking", statusCode: 200, durationMs: 840, requestOutcome: "SUCCESS", pageTemplate: "/trial", pageTitle: "试听预约" },
          { seq: 5, offsetMs: 152000, type: JourneyEventType.FEEDBACK, title: "展示预约成功", description: "页面展示预约成功状态。", uiFeedback: "success_state", targetLabel: "预约成功", pageTemplate: "/trial-success", pageTitle: "预约成功" },
        ],
        evidences: [
          { eventSeq: 4, type: EvidenceType.NETWORK, title: "预约请求成功", description: "试听预约请求稳定返回。", severity: EvidenceSeverity.INFO, offsetMs: 118000, content: "{ \"path\": \"/api/trial/booking\", \"status\": 200 }" },
        ],
      },
      "J-240601-302": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入课程报名页", description: "家长进入课程报名页面。", pageUrl: "https://enroll.polar-edu.com/enroll", pageTemplate: "/enroll", pageTitle: "课程报名", businessIntent: "完成报名支付" },
          { seq: 2, offsetMs: 32000, type: JourneyEventType.BUSINESS_ACTION, title: "确认学员与课程信息", description: "用户确认课程与学员信息。", region: "报名表单", uiAction: "submit", businessAction: "报名确认", targetLabel: "下一步", pageTemplate: "/enroll", pageTitle: "课程报名" },
          { seq: 3, offsetMs: 78000, type: JourneyEventType.REGION_ACTION, title: "输入验证码", description: "用户输入手机验证码准备完成支付。", region: "验证码弹层", uiAction: "input", businessAction: "安全校验", targetLabel: "短信验证码", pageTemplate: "/enroll", pageTitle: "课程报名" },
          { seq: 4, offsetMs: 122000, type: JourneyEventType.REQUEST, title: "验证码校验失败", description: "验证码校验接口返回 500。", requestHost: "api.polar-edu.com", method: "POST", pathTemplate: "/api/enroll/verify-code", statusCode: 500, durationMs: 1730, requestOutcome: "FAILED", pageTemplate: "/enroll", pageTitle: "课程报名", isAnomaly: true },
          { seq: 5, offsetMs: 124000, type: JourneyEventType.FEEDBACK, title: "出现错误 toast", description: "页面提示验证码校验失败。", region: "全局提示层", uiFeedback: "toast.error", targetLabel: "验证码校验失败，请稍后重试", pageTemplate: "/enroll", pageTitle: "课程报名", isAnomaly: true },
          { seq: 6, offsetMs: 203000, type: JourneyEventType.EXIT, title: "用户离开报名页", description: "用户没有再次尝试输入验证码。", pageTemplate: "/enroll", pageTitle: "课程报名", isAnomaly: true },
        ],
        evidences: [
          { eventSeq: 4, type: EvidenceType.NETWORK, title: "验证码校验失败请求", description: "验证码校验接口返回 500。", severity: EvidenceSeverity.CRITICAL, offsetMs: 122000, content: "{ \"path\": \"/api/enroll/verify-code\", \"status\": 500 }" },
          { eventSeq: 5, type: EvidenceType.TOAST, title: "验证码失败 toast", description: "错误提示没有给出补救路径。", severity: EvidenceSeverity.WARNING, offsetMs: 124000, content: "验证码校验失败，请稍后重试" },
        ],
      },
      "J-240601-303": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入课程介绍页", description: "家长浏览课程介绍与师资。", pageUrl: "https://enroll.polar-edu.com/course/reading", pageTemplate: "/course/[slug]", pageTitle: "课程介绍", businessIntent: "了解课程" },
          { seq: 2, offsetMs: 31000, type: JourneyEventType.REGION_ACTION, title: "查看课程大纲", description: "用户滚动到课程大纲区域。", region: "课程大纲", uiAction: "scroll_into_view", businessAction: "课程浏览", targetLabel: "课程大纲", pageTemplate: "/course/[slug]", pageTitle: "课程介绍" },
          { seq: 3, offsetMs: 94000, type: JourneyEventType.EXIT, title: "离开课程页", description: "用户没有继续进入试听或报名动作。", pageTemplate: "/course/[slug]", pageTitle: "课程介绍" },
        ],
        evidences: [
          { eventSeq: 2, type: EvidenceType.SCREENSHOT, title: "课程大纲浏览关键帧", description: "浏览后没有看到更强的下一步转化动作。", severity: EvidenceSeverity.INFO, offsetMs: 32000 },
        ],
      },
      "J-240601-304": {
        events: [
          { seq: 1, offsetMs: 0, type: JourneyEventType.PAGE_VIEW, title: "进入作业提交页", description: "老师进入作业批注与提交页面。", pageUrl: "https://classroom.polar-edu.com/homework/submit", pageTemplate: "/homework/submit", pageTitle: "作业提交", businessIntent: "完成作业提交" },
          { seq: 2, offsetMs: 42000, type: JourneyEventType.BUSINESS_ACTION, title: "上传批注与评分", description: "老师完成批注上传并设置评分。", region: "作业表单", uiAction: "submit", businessAction: "作业批改", targetLabel: "保存评分", pageTemplate: "/homework/submit", pageTitle: "作业提交" },
          { seq: 3, offsetMs: 161000, type: JourneyEventType.REGION_ACTION, title: "查看评分说明", description: "老师在评分说明区域停留较久，反复查看示例。", region: "评分说明", uiAction: "expand_panel", businessAction: "评分确认", targetLabel: "查看评分示例", pageTemplate: "/homework/submit", pageTitle: "作业提交" },
          { seq: 4, offsetMs: 232000, type: JourneyEventType.REQUEST, title: "作业提交成功", description: "作业提交请求返回成功。", requestHost: "api.polar-edu.com", method: "POST", pathTemplate: "/api/homework/submit", statusCode: 200, durationMs: 880, requestOutcome: "SUCCESS", pageTemplate: "/homework/submit", pageTitle: "作业提交" },
          { seq: 5, offsetMs: 288000, type: JourneyEventType.FEEDBACK, title: "展示提交成功", description: "页面展示提交成功状态。", uiFeedback: "success_state", targetLabel: "提交成功", pageTemplate: "/homework/success", pageTitle: "提交成功" },
        ],
        evidences: [
          { eventSeq: 3, type: EvidenceType.DOM_SNAPSHOT, title: "评分说明区域快照", description: "评分说明与示例文案较长，首屏没有先给出简要结论。", severity: EvidenceSeverity.WARNING, offsetMs: 162000 },
          { eventSeq: 3, type: EvidenceType.SCREENSHOT, title: "评分说明长停留关键帧", description: "老师停留在评分示例区域。", severity: EvidenceSeverity.INFO, offsetMs: 163000 },
        ],
      },
    },
  },
];

async function createTenantDataset(dataset: TenantDataset) {
  const tenant = await prisma.tenant.create({
    data: {
      ...dataset.tenant,
      logoUrl: null,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(1),
    },
  });

  const applications = await Promise.all(
    dataset.applications.map((application) =>
      prisma.application.create({
        data: {
          ...application,
          tenantId: tenant.id,
        },
      }),
    ),
  );
  const appById = Object.fromEntries(applications.map((application) => [application.id, application]));

  const tags = await Promise.all(
    dataset.tags.map((tag) =>
      prisma.tag.create({
        data: {
          tenantId: tenant.id,
          applicationId: appById[tag.applicationId].id,
          name: tag.name,
          type: tag.type,
          source: tag.source,
          color: tag.color,
          description: tag.description,
        },
      }),
    ),
  );
  const tagByName = Object.fromEntries(tags.map((tag) => [tag.name, tag]));

  const users = await Promise.all(
    dataset.users.map((user) =>
      prisma.user.create({
        data: {
          id: user.id,
          tenantId: tenant.id,
          applicationId: appById[user.applicationId].id,
          externalId: user.externalId,
          name: user.name,
          email: user.email,
          avatarSeed: user.avatarSeed,
          deviceType: user.deviceType,
          os: user.os,
          browser: user.browser,
          location: user.location,
          firstSeenAt: user.firstSeenAt,
          lastActiveAt: user.lastActiveAt,
          userTags: {
            create: user.tags.map((tagName) => ({
              tagId: tagByName[tagName].id,
            })),
          },
        },
      }),
    ),
  );
  const userById = Object.fromEntries(users.map((user) => [user.id, user]));

  const journeys = await Promise.all(
    dataset.journeys.map((journey) =>
      prisma.journey.create({
        data: {
          id: journey.id,
          tenantId: tenant.id,
          applicationId: appById[journey.applicationId].id,
          userId: userById[journey.userId].id,
          journeyCode: journey.journeyCode,
          title: journey.title,
          startedAt: journey.startedAt,
          endedAt: journey.endedAt,
          totalDurationMs: journey.totalDurationMs,
          effectiveDurationMs: journey.effectiveDurationMs,
          pageCount: journey.pageCount,
          keyActionCount: journey.keyActionCount,
          requestCount: journey.requestCount,
          resultStatus: journey.resultStatus,
          hasAnomaly: journey.hasAnomaly,
          pageUrl: journey.pageUrl,
          pageTemplate: journey.pageTemplate,
          pageTitle: journey.pageTitle,
          businessActionType: journey.businessActionType,
          aiSummaryShort: journey.aiSummaryShort,
          aiScenarioSummary: journey.aiScenarioSummary,
          aiProcessSummary: journey.aiProcessSummary,
          aiGoalAnalysis: journey.aiGoalAnalysis,
          aiAnomalyAnalysis: journey.aiAnomalyAnalysis,
          createdAt: journey.createdAt,
          journeyTags: {
            create: journey.tags.map((tagName) => ({
              tagId: tagByName[tagName].id,
            })),
          },
        },
      }),
    ),
  );
  const journeyByCode = Object.fromEntries(journeys.map((journey) => [journey.journeyCode, journey]));

  const projects = await Promise.all(
    dataset.projects.map((project) =>
      prisma.project.create({
        data: {
          id: project.id,
          tenantId: tenant.id,
          applicationId: appById[project.applicationId].id,
          projectCode: project.projectCode,
          name: project.name,
          goal: project.goal,
          focusArea: project.focusArea,
          focusTarget: project.focusTarget,
          focusFeature: project.focusFeature,
          ownerName: project.ownerName,
          description: project.description,
          filterTimeRangeLabel: project.filterTimeRangeLabel,
          filterPageTemplates: project.filterPageTemplates,
          filterStatuses: project.filterStatuses,
          filterTagRules: project.filterTagRules,
          createdAt: project.createdAt,
        },
      }),
    ),
  );
  const projectById = Object.fromEntries(projects.map((project) => [project.id, project]));

  for (const project of dataset.projects) {
    await prisma.projectJourney.createMany({
      data: project.journeyCodes.map((journeyCode, index) => ({
        projectId: projectById[project.id].id,
        journeyId: journeyByCode[journeyCode].id,
        addedAt: new Date(project.createdAt.getTime() + index * 3600 * 1000),
      })),
    });

    await prisma.projectFinding.createMany({
      data: project.findings.map((finding) => ({
        projectId: projectById[project.id].id,
        title: finding.title,
        summary: finding.summary,
        category: finding.category,
        evidenceJourneyCount: finding.evidenceJourneyCount,
        sortOrder: finding.sortOrder,
      })),
    });
  }

  await prisma.integrationLog.createMany({
    data: dataset.integrationLogs.map((log) => ({
      tenantId: tenant.id,
      applicationId: appById[log.applicationId].id,
      level: log.level,
      status: log.status,
      source: log.source,
      message: log.message,
      payloadSummary: log.payloadSummary,
      createdAt: log.createdAt,
    })),
  });

  for (const [journeyCode, story] of Object.entries(dataset.stories)) {
    const journey = journeyByCode[journeyCode];
    const eventIdBySeq = new Map<number, string>();

    for (const event of story.events) {
      const createdEvent = await prisma.journeyEvent.create({
        data: {
          journeyId: journey.id,
          occurredAt: new Date(journey.startedAt.getTime() + event.offsetMs),
          seq: event.seq,
          offsetMs: event.offsetMs,
          type: event.type,
          title: event.title,
          description: event.description,
          pageUrl: event.pageUrl,
          pageTemplate: event.pageTemplate,
          pageTitle: event.pageTitle,
          region: event.region,
          uiAction: event.uiAction,
          businessAction: event.businessAction,
          businessIntent: event.businessIntent,
          targetLabel: event.targetLabel,
          requestHost: event.requestHost,
          method: event.method,
          pathTemplate: event.pathTemplate,
          statusCode: event.statusCode,
          durationMs: event.durationMs,
          requestOutcome: event.requestOutcome,
          uiFeedback: event.uiFeedback,
          isKeyEvent: true,
          isAnomaly: event.isAnomaly ?? false,
        },
      });
      eventIdBySeq.set(event.seq, createdEvent.id);
    }

    for (const evidence of story.evidences) {
      await prisma.evidence.create({
        data: {
          journeyId: journey.id,
          journeyEventId: evidence.eventSeq ? eventIdBySeq.get(evidence.eventSeq) : undefined,
          type: evidence.type,
          title: evidence.title,
          description: evidence.description,
          severity: evidence.severity,
          content: evidence.content,
          offsetMs: evidence.offsetMs,
          capturedAt: new Date(journey.startedAt.getTime() + evidence.offsetMs),
        },
      });
    }
  }
}

async function main() {
  await prisma.projectFinding.deleteMany();
  await prisma.integrationLog.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.journeyEvent.deleteMany();
  await prisma.projectJourney.deleteMany();
  await prisma.journeyTag.deleteMany();
  await prisma.userTag.deleteMany();
  await prisma.project.deleteMany();
  await prisma.journey.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
  await prisma.application.deleteMany();
  await prisma.tenant.deleteMany();

  for (const dataset of datasets) {
    await createTenantDataset(dataset);
  }

  await validateSeedIntegrity();
  console.log("Seed multi-tenant demo data validated successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
