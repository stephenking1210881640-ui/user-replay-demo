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
} from "@prisma/client";

const prisma = new PrismaClient();
const now = new Date("2026-06-02T10:00:00.000Z");

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function hoursAgo(hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

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
    regionSource?: string;
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
    isKeyEvent?: boolean;
    isAnomaly?: boolean;
  }>;
  evidences: Array<{
    eventSeq?: number;
    type: EvidenceType;
    title: string;
    description: string;
    severity: EvidenceSeverity;
    offsetMs: number;
    imageUrl?: string;
    content?: string;
  }>;
};

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

  const application = await prisma.application.create({
    data: {
      name: "InsightFlow Commerce Demo",
      appKey: "if_demo_checkout_web",
      host: "demo.insightflow.app",
      description:
        "用于演示 Web 接入、旅程回放、AI 总结、标签维护和研究项目归档闭环的用户回放平台 Demo。",
      status: ApplicationStatus.CONNECTED,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
      lastReportedAt: minutesAgo(3),
    },
  });

  const tagDefinitions = [
    {
      name: "高意向",
      type: TagType.USER,
      source: TagSource.RULE,
      color: "#dbeafe",
      description: "近 7 天多次进入结算链路，存在明确成交意图。",
    },
    {
      name: "价格敏感",
      type: TagType.USER,
      source: TagSource.MANUAL,
      color: "#ffedd5",
      description: "对优惠、运费和总价变化高度敏感。",
    },
    {
      name: "异常关注",
      type: TagType.USER,
      source: TagSource.SYSTEM,
      color: "#fee2e2",
      description: "近期多次经历异常请求或错误反馈。",
    },
    {
      name: "新用户",
      type: TagType.USER,
      source: TagSource.SYSTEM,
      color: "#dcfce7",
      description: "首次出现时间较近，仍在建立产品心智。",
    },
    {
      name: "核心用户",
      type: TagType.USER,
      source: TagSource.MANUAL,
      color: "#ede9fe",
      description: "长期稳定使用产品，具备高完成度行为。",
    },
    {
      name: "BI 分析师",
      type: TagType.USER,
      source: TagSource.MANUAL,
      color: "#e0f2fe",
      description: "典型分析角色，以看数和验证流程为主。",
    },
    {
      name: "支付失败",
      type: TagType.JOURNEY,
      source: TagSource.SYSTEM,
      color: "#fee2e2",
      description: "支付前后关键请求失败，阻断目标完成。",
    },
    {
      name: "费用疑惑",
      type: TagType.JOURNEY,
      source: TagSource.MANUAL,
      color: "#ffedd5",
      description: "用户在费用明细、运费或应付总额处出现明显犹豫。",
    },
    {
      name: "顺利完成",
      type: TagType.JOURNEY,
      source: TagSource.RULE,
      color: "#dcfce7",
      description: "标准健康路径样本，可用作基准对照。",
    },
    {
      name: "长停滞犹豫",
      type: TagType.JOURNEY,
      source: TagSource.SYSTEM,
      color: "#fef3c7",
      description: "存在长停留或重复查看，但不一定最终失败。",
    },
    {
      name: "仅浏览退出",
      type: TagType.JOURNEY,
      source: TagSource.RULE,
      color: "#e2e8f0",
      description: "未进入核心转化动作，仅完成浅层浏览后退出。",
    },
    {
      name: "中途放弃",
      type: TagType.JOURNEY,
      source: TagSource.RULE,
      color: "#f1f5f9",
      description: "用户在完成核心任务前主动离开流程。",
    },
    {
      name: "权限犹豫",
      type: TagType.JOURNEY,
      source: TagSource.MANUAL,
      color: "#fae8ff",
      description: "用户在权限相关信息处反复查看或长时间停留。",
    },
  ] as const;

  const tags = await Promise.all(
    tagDefinitions.map((tag) =>
      prisma.tag.create({
        data: {
          applicationId: application.id,
          ...tag,
        },
      }),
    ),
  );

  const tagByName = Object.fromEntries(tags.map((tag) => [tag.name, tag]));

  const users = await Promise.all([
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-240601-001",
        name: "Mia Chen",
        email: "mia.chen@example.com",
        avatarSeed: "M",
        deviceType: "Desktop",
        os: "macOS 14.5",
        browser: "Chrome 126",
        location: "上海",
        firstSeenAt: daysAgo(28),
        lastActiveAt: minutesAgo(6),
        userTags: {
          create: [
            { tagId: tagByName["高意向"].id },
            { tagId: tagByName["异常关注"].id },
          ],
        },
      },
    }),
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-240601-002",
        name: "Leo Xu",
        email: "leo.xu@example.com",
        avatarSeed: "L",
        deviceType: "Desktop",
        os: "Windows 11",
        browser: "Edge 126",
        location: "杭州",
        firstSeenAt: daysAgo(12),
        lastActiveAt: hoursAgo(3),
        userTags: {
          create: [
            { tagId: tagByName["价格敏感"].id },
            { tagId: tagByName["新用户"].id },
          ],
        },
      },
    }),
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-240601-003",
        name: "Ada Lin",
        email: "ada.lin@example.com",
        avatarSeed: "A",
        deviceType: "Desktop",
        os: "macOS 14.5",
        browser: "Safari 17",
        location: "深圳",
        firstSeenAt: daysAgo(63),
        lastActiveAt: hoursAgo(9),
        userTags: {
          create: [
            { tagId: tagByName["核心用户"].id },
            { tagId: tagByName["BI 分析师"].id },
          ],
        },
      },
    }),
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-240601-004",
        name: "Ethan Wu",
        email: "ethan.wu@example.com",
        avatarSeed: "E",
        deviceType: "Mobile Web",
        os: "iOS 17",
        browser: "Safari Mobile",
        location: "北京",
        firstSeenAt: daysAgo(7),
        lastActiveAt: hoursAgo(12),
        userTags: {
          create: [{ tagId: tagByName["新用户"].id }],
        },
      },
    }),
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-240601-005",
        name: "Nora Gao",
        email: "nora.gao@example.com",
        avatarSeed: "N",
        deviceType: "Desktop",
        os: "Windows 11",
        browser: "Chrome 126",
        location: "广州",
        firstSeenAt: daysAgo(34),
        lastActiveAt: hoursAgo(4),
        userTags: {
          create: [
            { tagId: tagByName["高意向"].id },
            { tagId: tagByName["价格敏感"].id },
          ],
        },
      },
    }),
  ]);

  const userByExternalId = Object.fromEntries(users.map((user) => [user.externalId, user]));

  const journeys = await Promise.all([
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-240601-001"].id,
        journeyCode: "J-240601-001",
        title: "支付组件初始化失败导致结算中断",
        startedAt: hoursAgo(5),
        endedAt: new Date(hoursAgo(5).getTime() + 186000),
        totalDurationMs: 186000,
        effectiveDurationMs: 149000,
        pageCount: 4,
        keyActionCount: 9,
        requestCount: 6,
        resultStatus: JourneyResultStatus.FAILED,
        hasAnomaly: true,
        pageUrl: "https://demo.insightflow.app/checkout",
        pageTemplate: "/checkout",
        pageTitle: "订单结算",
        businessActionType: "支付提交",
        aiSummaryShort:
          "用户已完成地址与优惠确认，但在提交支付时支付 SDK 初始化失败，错误 toast 出现后停滞 15 秒并退出。",
        aiScenarioSummary:
          "本次旅程处于高意向结算场景，用户目标非常明确，即完成支付并结束购买流程。",
        aiProcessSummary:
          "用户先确认地址和优惠券，再点击确认支付；支付初始化请求失败后，用户没有可继续路径，只能停留后离开。",
        aiGoalAnalysis:
          "目标未达成。关键阻断点发生在支付组件初始化阶段，导致支付提交流程没有真正开始。",
        aiAnomalyAnalysis:
          "存在明确技术异常：支付 SDK mount 失败，错误 toast 与失败请求证据完整，可直接归因为前端支付链路阻断。",
        createdAt: hoursAgo(5),
        journeyTags: {
          create: [
            { tagId: tagByName["支付失败"].id },
            { tagId: tagByName["中途放弃"].id },
          ],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-240601-002"].id,
        journeyCode: "J-240601-002",
        title: "费用说明理解不清后返回购物车并放弃",
        startedAt: hoursAgo(8),
        endedAt: new Date(hoursAgo(8).getTime() + 324000),
        totalDurationMs: 324000,
        effectiveDurationMs: 219000,
        pageCount: 5,
        keyActionCount: 8,
        requestCount: 4,
        resultStatus: JourneyResultStatus.ABANDONED,
        hasAnomaly: false,
        pageUrl: "https://demo.insightflow.app/checkout",
        pageTemplate: "/checkout",
        pageTitle: "订单结算",
        businessActionType: "费用确认",
        aiSummaryShort:
          "用户反复展开费用明细并返回购物车修改商品数量，第二次进入结算页后仍停留较久，最终未提交支付。",
        aiScenarioSummary:
          "本次旅程属于价格敏感型结算确认，用户核心诉求是理解订单总价为何变化。",
        aiProcessSummary:
          "用户两次打开费用明细，一次回退到购物车修改商品，再次进入后长时间停留在应付总额区域并直接关闭页面。",
        aiGoalAnalysis:
          "目标未达成。用户没有进入支付阶段，阻塞发生在费用理解与信任建立环节。",
        aiAnomalyAnalysis:
          "没有技术报错，但存在长停留、重复展开说明和路径回退，属于高理解成本导致的行为性流失。",
        createdAt: hoursAgo(8),
        journeyTags: {
          create: [
            { tagId: tagByName["费用疑惑"].id },
            { tagId: tagByName["中途放弃"].id },
            { tagId: tagByName["长停滞犹豫"].id },
          ],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-240601-003"].id,
        journeyCode: "J-240601-003",
        title: "标准结算路径顺利完成支付",
        startedAt: hoursAgo(18),
        endedAt: new Date(hoursAgo(18).getTime() + 164000),
        totalDurationMs: 164000,
        effectiveDurationMs: 149000,
        pageCount: 4,
        keyActionCount: 10,
        requestCount: 5,
        resultStatus: JourneyResultStatus.COMPLETED,
        hasAnomaly: false,
        pageUrl: "https://demo.insightflow.app/checkout",
        pageTemplate: "/checkout",
        pageTitle: "订单结算",
        businessActionType: "支付提交",
        aiSummaryShort:
          "用户快速完成地址确认、优惠券选择与支付提交，支付回调成功，整个流程没有回退与异常。",
        aiScenarioSummary:
          "这是典型的高明确度购买场景，可作为健康基准路径对照样本。",
        aiProcessSummary:
          "用户从购物车进入结算页后连续完成确认动作，支付请求一次成功，并跳转到支付成功页。",
        aiGoalAnalysis:
          "目标已达成。路径连续、动作清晰、请求成功，说明核心转化链路在该样本中表现健康。",
        aiAnomalyAnalysis:
          "未发现异常请求或负向反馈，适合作为对比失败与放弃旅程时的基线样本。",
        createdAt: hoursAgo(18),
        journeyTags: {
          create: [{ tagId: tagByName["顺利完成"].id }],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-240601-003"].id,
        journeyCode: "J-240601-004",
        title: "权限说明区域长停滞后完成新手引导",
        startedAt: daysAgo(1),
        endedAt: new Date(daysAgo(1).getTime() + 412000),
        totalDurationMs: 412000,
        effectiveDurationMs: 238000,
        pageCount: 6,
        keyActionCount: 12,
        requestCount: 4,
        resultStatus: JourneyResultStatus.COMPLETED,
        hasAnomaly: false,
        pageUrl: "https://demo.insightflow.app/onboarding",
        pageTemplate: "/onboarding",
        pageTitle: "新手引导",
        businessActionType: "初始化配置",
        aiSummaryShort:
          "用户在权限说明页停留 2 分 40 秒并多次展开解释文案，最终仍完成配置流程，属于长停滞但成功达成目标的旅程。",
        aiScenarioSummary:
          "用户目标是首次完成账户初始化并进入工作台，属于上手成功率研究的重要样本。",
        aiProcessSummary:
          "组织信息和通知配置都较顺畅，真正的停滞点出现在权限授权说明区域，用户多次查看解释后继续完成。",
        aiGoalAnalysis:
          "目标已达成，但完成成本偏高。权限说明仍可能影响新用户对安全边界和收益的理解。",
        aiAnomalyAnalysis:
          "没有技术异常，不过存在显著犹豫行为，应纳入交互与文案优化研究。",
        createdAt: daysAgo(1),
        journeyTags: {
          create: [
            { tagId: tagByName["顺利完成"].id },
            { tagId: tagByName["长停滞犹豫"].id },
            { tagId: tagByName["权限犹豫"].id },
          ],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-240601-004"].id,
        journeyCode: "J-240601-005",
        title: "浏览商品详情与评价后直接退出",
        startedAt: daysAgo(2),
        endedAt: new Date(daysAgo(2).getTime() + 98000),
        totalDurationMs: 98000,
        effectiveDurationMs: 73000,
        pageCount: 3,
        keyActionCount: 4,
        requestCount: 2,
        resultStatus: JourneyResultStatus.BROWSING,
        hasAnomaly: false,
        pageUrl: "https://demo.insightflow.app/products/insights-pro",
        pageTemplate: "/products/[slug]",
        pageTitle: "Insight Pro 商品详情",
        businessActionType: "商品浏览",
        aiSummaryShort:
          "用户停留在商品详情和评价区域，没有加入购物车或点击试用，浏览后直接离开。",
        aiScenarioSummary:
          "本次旅程偏向前期信息收集，用户尚未形成明确转化意图。",
        aiProcessSummary:
          "用户先浏览产品卖点，再查看价格和评价模块，没有触发任何深层业务动作，随后退出页面。",
        aiGoalAnalysis:
          "没有足够证据表明用户带着强转化目标而来，但可以确认其未进入核心转化链路。",
        aiAnomalyAnalysis:
          "未发现异常。该旅程更适合用于研究首屏内容与转化入口的吸引力是否不足。",
        createdAt: daysAgo(2),
        journeyTags: {
          create: [{ tagId: tagByName["仅浏览退出"].id }],
        },
      },
    }),
  ]);

  const journeyByCode = Object.fromEntries(journeys.map((journey) => [journey.journeyCode, journey]));

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        applicationId: application.id,
        projectCode: "P-240601-CHK",
        name: "新版结算页可用性验证",
        goal:
          "验证新版结算页是否能让用户快速理解价格构成并顺利完成支付，定位费用理解与支付提交环节的阻断点。",
        focusArea: "结算与支付体验",
        focusTarget: "高意向下单用户",
        focusFeature: "结算页 / 支付提交",
        ownerName: "林晓雯",
        description:
          "该项目以真实结算样本为核心，关注费用说明、优惠券反馈、支付提交稳定性三类问题，沉淀可解释的证据链。",
        filterTimeRangeLabel: "近 7 天高意向结算旅程",
        filterPageTemplates: "/checkout, /payment",
        filterStatuses: "已完成, 中途放弃, 异常失败",
        filterTagRules: "支付失败, 费用疑惑, 长停滞犹豫",
        createdAt: daysAgo(4),
      },
    }),
    prisma.project.create({
      data: {
        applicationId: application.id,
        projectCode: "P-240601-ONB",
        name: "新手引导理解成本观察",
        goal:
          "观察首次使用者在初始化配置过程中的理解阻塞，重点确认权限与说明文案是否造成额外学习成本。",
        focusArea: "Onboarding 转化",
        focusTarget: "新用户",
        focusFeature: "Onboarding / 权限说明",
        ownerName: "周亦凡",
        description:
          "该项目用于收集新手引导的顺利完成样本与长停留样本，把“是否最终完成”与“完成成本是否合理”分开看待。",
        filterTimeRangeLabel: "近 14 天首次配置旅程",
        filterPageTemplates: "/onboarding, /workspace",
        filterStatuses: "已完成",
        filterTagRules: "新用户, 权限犹豫, 长停滞犹豫",
        createdAt: daysAgo(7),
      },
    }),
  ]);

  const projectByCode = Object.fromEntries(projects.map((project) => [project.projectCode, project]));

  await prisma.projectJourney.createMany({
    data: [
      {
        projectId: projectByCode["P-240601-CHK"].id,
        journeyId: journeyByCode["J-240601-001"].id,
        addedAt: hoursAgo(2),
      },
      {
        projectId: projectByCode["P-240601-CHK"].id,
        journeyId: journeyByCode["J-240601-002"].id,
        addedAt: hoursAgo(3),
      },
      {
        projectId: projectByCode["P-240601-CHK"].id,
        journeyId: journeyByCode["J-240601-003"].id,
        addedAt: daysAgo(1),
      },
      {
        projectId: projectByCode["P-240601-ONB"].id,
        journeyId: journeyByCode["J-240601-004"].id,
        addedAt: hoursAgo(10),
      },
    ],
  });

  await prisma.projectFinding.createMany({
    data: [
      {
        projectId: projectByCode["P-240601-CHK"].id,
        title: "费用解释区是中途放弃的主要认知阻塞点",
        summary:
          "在已归档旅程中，用户在应付总额、运费和优惠明细区域反复展开说明，且经常伴随回退购物车，说明价格解释链路仍不够直接。",
        category: FindingCategory.INSIGHT,
        evidenceJourneyCount: 2,
        sortOrder: 1,
      },
      {
        projectId: projectByCode["P-240601-CHK"].id,
        title: "支付初始化异常会直接击穿高意向用户的完成路径",
        summary:
          "异常样本显示用户已完成全部前置动作，但支付 SDK 初始化失败后没有可恢复路径，导致高意向用户快速流失。",
        category: FindingCategory.TECHNICAL,
        evidenceJourneyCount: 1,
        sortOrder: 2,
      },
      {
        projectId: projectByCode["P-240601-ONB"].id,
        title: "权限说明不会直接导致失败，但会显著提高完成成本",
        summary:
          "虽然样本最终完成，但权限说明区域的长停留明显拉长了总时长，建议优化文案结构与风险解释方式。",
        category: FindingCategory.INTERACTION,
        evidenceJourneyCount: 1,
        sortOrder: 1,
      },
    ],
  });

  await prisma.integrationLog.createMany({
    data: [
      {
        applicationId: application.id,
        level: "info",
        status: "已接收",
        source: "collector.browser",
        message: "page_view 事件已入库，页面模板识别成功",
        payloadSummary: "/checkout · page_title=订单结算",
        createdAt: minutesAgo(3),
      },
      {
        applicationId: application.id,
        level: "info",
        status: "已聚合",
        source: "journey-builder",
        message: "旅程 J-240601-001 已完成事件聚合与 AI 摘要匹配",
        payloadSummary: "events=8 · evidences=4",
        createdAt: minutesAgo(4),
      },
      {
        applicationId: application.id,
        level: "warn",
        status: "部分降级",
        source: "region-recognizer",
        message: "1 条 region 识别回退到文本锚点模式",
        payloadSummary: "button[text=确认支付]",
        createdAt: minutesAgo(6),
      },
      {
        applicationId: application.id,
        level: "error",
        status: "异常",
        source: "sdk.runtime",
        message: "支付 SDK 上报初始化错误",
        payloadSummary: "TypeError: Cannot read properties of undefined (reading 'mount')",
        createdAt: minutesAgo(7),
      },
      {
        applicationId: application.id,
        level: "info",
        status: "已校验",
        source: "validator",
        message: "最近 24 小时活跃用户与旅程聚合校验完成",
        payloadSummary: "journeys=4 · active_users=4",
        createdAt: minutesAgo(9),
      },
    ],
  });

  const stories: Record<string, JourneyStorySeed> = {
    "J-240601-001": {
      events: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入结算页",
          description: "用户从购物车进入结算页，开始确认地址和订单信息。",
          pageUrl: "https://demo.insightflow.app/checkout",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
          businessIntent: "完成支付",
        },
        {
          seq: 2,
          offsetMs: 12000,
          type: JourneyEventType.REGION_ACTION,
          title: "确认收货地址",
          description: "用户展开地址卡片并确认默认收货地址。",
          region: "地址信息卡片",
          uiAction: "expand_card",
          businessAction: "地址确认",
          targetLabel: "默认地址",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 3,
          offsetMs: 47000,
          type: JourneyEventType.BUSINESS_ACTION,
          title: "尝试使用优惠券",
          description: "用户打开优惠券抽屉并选择一张满减券。",
          region: "优惠券区域",
          uiAction: "select_coupon",
          businessAction: "优惠券选择",
          businessIntent: "降低支付金额",
          targetLabel: "满减券",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 4,
          offsetMs: 62000,
          type: JourneyEventType.REQUEST,
          title: "优惠券校验完成",
          description: "优惠券校验请求返回成功，金额刷新正常。",
          requestHost: "api.insightflow.app",
          method: "POST",
          pathTemplate: "/api/checkout/coupon/validate",
          statusCode: 200,
          durationMs: 820,
          requestOutcome: "SUCCESS",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 5,
          offsetMs: 104000,
          type: JourneyEventType.BUSINESS_ACTION,
          title: "点击确认支付",
          description: "用户确认总价后点击页面底部确认支付按钮。",
          region: "底部支付栏",
          uiAction: "click",
          businessAction: "支付提交",
          businessIntent: "发起支付",
          targetLabel: "确认支付",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 6,
          offsetMs: 109000,
          type: JourneyEventType.REQUEST,
          title: "支付 SDK 初始化失败",
          description: "支付组件初始化请求返回 500，前端未成功 mount 支付面板。",
          requestHost: "pay.insightflow.app",
          method: "POST",
          pathTemplate: "/sdk/payment/init",
          statusCode: 500,
          durationMs: 1420,
          requestOutcome: "FAILED",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
          isAnomaly: true,
        },
        {
          seq: 7,
          offsetMs: 111000,
          type: JourneyEventType.FEEDBACK,
          title: "页面弹出错误 toast",
          description: "支付按钮区域出现错误提示，提示稍后重试。",
          region: "全局提示层",
          uiFeedback: "toast.error",
          targetLabel: "支付组件加载失败，请稍后重试",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
          isAnomaly: true,
        },
        {
          seq: 8,
          offsetMs: 186000,
          type: JourneyEventType.EXIT,
          title: "用户离开结算页",
          description: "用户在错误提示后停留 15 秒，没有二次尝试，随后退出页面。",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
          isAnomaly: true,
        },
      ],
      evidences: [
        {
          eventSeq: 6,
          type: EvidenceType.NETWORK,
          title: "支付初始化请求失败",
          description: "支付初始化请求返回 500，body 中包含 SDK mount 失败信息。",
          severity: EvidenceSeverity.CRITICAL,
          offsetMs: 109000,
          content:
            "{\n  \"path\": \"/sdk/payment/init\",\n  \"status\": 500,\n  \"error\": \"PaymentSDK.mount failed\"\n}",
        },
        {
          eventSeq: 6,
          type: EvidenceType.ERROR_NOTE,
          title: "前端异常堆栈",
          description: "前端在初始化支付容器时抛出 TypeError。",
          severity: EvidenceSeverity.CRITICAL,
          offsetMs: 109300,
          content:
            "TypeError: Cannot read properties of undefined (reading 'mount') at PaymentContainer.init",
        },
        {
          eventSeq: 7,
          type: EvidenceType.TOAST,
          title: "错误 toast 文案",
          description: "界面只给出笼统错误提示，没有可恢复动作说明。",
          severity: EvidenceSeverity.WARNING,
          offsetMs: 111000,
          content: "支付组件加载失败，请稍后重试",
        },
        {
          eventSeq: 7,
          type: EvidenceType.SCREENSHOT,
          title: "错误态关键帧",
          description: "确认支付按钮下方出现错误提示，页面主体无进一步反馈。",
          severity: EvidenceSeverity.INFO,
          offsetMs: 111500,
        },
      ],
    },
    "J-240601-002": {
      events: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "首次进入结算页",
          description: "用户从购物车进入结算页，首先查看订单金额构成。",
          pageUrl: "https://demo.insightflow.app/checkout",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
          businessIntent: "确认费用后下单",
        },
        {
          seq: 2,
          offsetMs: 18000,
          type: JourneyEventType.REGION_ACTION,
          title: "展开费用明细",
          description: "用户展开总价明细查看运费和优惠抵扣组成。",
          region: "费用明细抽屉",
          uiAction: "expand_panel",
          businessAction: "费用确认",
          targetLabel: "明细展开",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 3,
          offsetMs: 56000,
          type: JourneyEventType.REQUEST,
          title: "运费重算完成",
          description: "切换配送方式后，运费重算请求成功但耗时偏长。",
          requestHost: "api.insightflow.app",
          method: "POST",
          pathTemplate: "/api/checkout/shipping/calc",
          statusCode: 200,
          durationMs: 2380,
          requestOutcome: "SUCCESS",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 4,
          offsetMs: 103000,
          type: JourneyEventType.STATE_CHANGE,
          title: "返回购物车修改商品",
          description: "用户返回购物车，减少商品数量后重新进入结算页。",
          businessAction: "商品调整",
          businessIntent: "降低订单总价",
          pageTemplate: "/cart",
          pageTitle: "购物车",
        },
        {
          seq: 5,
          offsetMs: 146000,
          type: JourneyEventType.PAGE_VIEW,
          title: "再次进入结算页",
          description: "用户修改购物车后再次回到结算页，继续查看应付总额。",
          pageUrl: "https://demo.insightflow.app/checkout",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 6,
          offsetMs: 221000,
          type: JourneyEventType.REGION_ACTION,
          title: "再次展开费用明细",
          description: "用户第二次展开费用说明，重点查看运费变化原因。",
          region: "费用明细抽屉",
          uiAction: "expand_panel",
          businessAction: "费用确认",
          targetLabel: "运费明细",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 7,
          offsetMs: 324000,
          type: JourneyEventType.EXIT,
          title: "用户关闭页面",
          description: "长时间停留后没有继续支付，用户直接退出流程。",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
      ],
      evidences: [
        {
          eventSeq: 3,
          type: EvidenceType.NETWORK,
          title: "运费重算请求耗时偏长",
          description: "虽然请求成功，但 2.38 秒的响应放大了费用等待感。",
          severity: EvidenceSeverity.WARNING,
          offsetMs: 56000,
          content:
            "{\n  \"path\": \"/api/checkout/shipping/calc\",\n  \"status\": 200,\n  \"duration_ms\": 2380\n}",
        },
        {
          eventSeq: 6,
          type: EvidenceType.DOM_SNAPSHOT,
          title: "费用说明关键区域快照",
          description: "应付总额、运费与优惠金额被分散在不同块中，阅读成本较高。",
          severity: EvidenceSeverity.INFO,
          offsetMs: 221000,
        },
        {
          type: EvidenceType.SCREENSHOT,
          title: "长停留关键帧",
          description: "用户停留在应付总额区域附近，页面没有进一步引导。",
          severity: EvidenceSeverity.INFO,
          offsetMs: 290000,
        },
      ],
    },
    "J-240601-003": {
      events: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入结算页",
          description: "用户直接进入结算页，行为明确且连续。",
          pageUrl: "https://demo.insightflow.app/checkout",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
          businessIntent: "完成支付",
        },
        {
          seq: 2,
          offsetMs: 14000,
          type: JourneyEventType.REGION_ACTION,
          title: "确认地址与配送",
          description: "用户快速确认默认地址与配送方式。",
          region: "地址与配送信息",
          uiAction: "confirm",
          businessAction: "地址确认",
          targetLabel: "默认地址",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 3,
          offsetMs: 41000,
          type: JourneyEventType.BUSINESS_ACTION,
          title: "选择优惠券",
          description: "用户选中一张可用优惠券，金额刷新正常。",
          region: "优惠券抽屉",
          uiAction: "select_coupon",
          businessAction: "优惠券选择",
          targetLabel: "立减券",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 4,
          offsetMs: 72000,
          type: JourneyEventType.REQUEST,
          title: "创建支付订单",
          description: "支付订单创建成功，进入支付网关。",
          requestHost: "api.insightflow.app",
          method: "POST",
          pathTemplate: "/api/checkout/pay-order",
          statusCode: 200,
          durationMs: 760,
          requestOutcome: "SUCCESS",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 5,
          offsetMs: 93000,
          type: JourneyEventType.BUSINESS_ACTION,
          title: "点击确认支付",
          description: "用户发起支付，没有出现重复点击。",
          region: "底部支付栏",
          uiAction: "click",
          businessAction: "支付提交",
          businessIntent: "完成支付",
          targetLabel: "确认支付",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 6,
          offsetMs: 122000,
          type: JourneyEventType.FEEDBACK,
          title: "支付成功反馈",
          description: "用户收到支付成功状态并跳转到成功页。",
          uiFeedback: "success_state",
          targetLabel: "支付成功",
          pageTemplate: "/payment-success",
          pageTitle: "支付成功",
        },
      ],
      evidences: [
        {
          eventSeq: 4,
          type: EvidenceType.NETWORK,
          title: "支付订单请求成功",
          description: "关键支付请求稳定返回 200，可作为健康链路对照。",
          severity: EvidenceSeverity.INFO,
          offsetMs: 72000,
          content:
            "{\n  \"path\": \"/api/checkout/pay-order\",\n  \"status\": 200,\n  \"duration_ms\": 760\n}",
        },
        {
          eventSeq: 6,
          type: EvidenceType.SCREENSHOT,
          title: "支付成功关键帧",
          description: "成功页展示订单完成状态，用户可继续查看订单。",
          severity: EvidenceSeverity.INFO,
          offsetMs: 122000,
        },
      ],
    },
    "J-240601-004": {
      events: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入新手引导",
          description: "用户第一次进入引导流程，开始填写组织信息。",
          pageUrl: "https://demo.insightflow.app/onboarding",
          pageTemplate: "/onboarding",
          pageTitle: "新手引导",
          businessIntent: "完成初始化配置",
        },
        {
          seq: 2,
          offsetMs: 36000,
          type: JourneyEventType.BUSINESS_ACTION,
          title: "填写组织信息",
          description: "组织信息填写顺利完成，继续进入权限配置。",
          region: "组织信息表单",
          uiAction: "submit",
          businessAction: "组织配置",
          targetLabel: "下一步",
          pageTemplate: "/onboarding",
          pageTitle: "新手引导",
        },
        {
          seq: 3,
          offsetMs: 87000,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入权限说明步骤",
          description: "用户进入权限说明页，开始阅读授权范围与用途。",
          pageTemplate: "/onboarding/permissions",
          pageTitle: "权限说明",
        },
        {
          seq: 4,
          offsetMs: 248000,
          type: JourneyEventType.REGION_ACTION,
          title: "多次展开权限解释",
          description: "用户多次展开 FAQ 与授权说明，停留时间显著偏长。",
          region: "权限说明 FAQ",
          uiAction: "expand_panel",
          businessAction: "权限确认",
          businessIntent: "理解授权边界",
          targetLabel: "查看详细解释",
          pageTemplate: "/onboarding/permissions",
          pageTitle: "权限说明",
        },
        {
          seq: 5,
          offsetMs: 301000,
          type: JourneyEventType.REQUEST,
          title: "权限配置保存成功",
          description: "权限配置请求成功，用户继续后续设置。",
          requestHost: "api.insightflow.app",
          method: "POST",
          pathTemplate: "/api/onboarding/permissions",
          statusCode: 200,
          durationMs: 940,
          requestOutcome: "SUCCESS",
          pageTemplate: "/onboarding/permissions",
          pageTitle: "权限说明",
        },
        {
          seq: 6,
          offsetMs: 412000,
          type: JourneyEventType.FEEDBACK,
          title: "进入工作台首页",
          description: "引导完成，系统跳转至工作台首页。",
          uiFeedback: "redirect.success",
          targetLabel: "工作台首页",
          pageTemplate: "/workspace",
          pageTitle: "工作台",
        },
      ],
      evidences: [
        {
          eventSeq: 4,
          type: EvidenceType.SCREENSHOT,
          title: "权限说明长停留关键帧",
          description: "用户停留在权限解释区域，连续阅读多段说明文案。",
          severity: EvidenceSeverity.INFO,
          offsetMs: 248000,
        },
        {
          eventSeq: 4,
          type: EvidenceType.DOM_SNAPSHOT,
          title: "权限说明文案结构快照",
          description: "权限解释内容较长，首屏未先给出清晰收益与风险边界摘要。",
          severity: EvidenceSeverity.WARNING,
          offsetMs: 249000,
        },
      ],
    },
    "J-240601-005": {
      events: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入商品详情页",
          description: "用户进入商品详情页，开始浏览卖点信息。",
          pageUrl: "https://demo.insightflow.app/products/insights-pro",
          pageTemplate: "/products/[slug]",
          pageTitle: "Insight Pro 商品详情",
          businessIntent: "了解产品能力",
        },
        {
          seq: 2,
          offsetMs: 24000,
          type: JourneyEventType.REGION_ACTION,
          title: "查看价格模块",
          description: "用户滚动到价格与套餐区域，没有点击咨询或试用按钮。",
          region: "价格套餐区",
          uiAction: "scroll_into_view",
          businessAction: "商品浏览",
          targetLabel: "价格套餐",
          pageTemplate: "/products/[slug]",
          pageTitle: "Insight Pro 商品详情",
        },
        {
          seq: 3,
          offsetMs: 54000,
          type: JourneyEventType.PAGE_VIEW,
          title: "切换到评价区域",
          description: "用户继续浏览用户评价与案例模块。",
          pageTemplate: "/products/[slug]",
          pageTitle: "Insight Pro 商品详情",
          region: "用户评价",
        },
        {
          seq: 4,
          offsetMs: 98000,
          type: JourneyEventType.EXIT,
          title: "用户离开商品详情页",
          description: "用户没有触发加入购物车或试用咨询动作，直接离开页面。",
          pageTemplate: "/products/[slug]",
          pageTitle: "Insight Pro 商品详情",
        },
      ],
      evidences: [
        {
          eventSeq: 2,
          type: EvidenceType.SCREENSHOT,
          title: "价格模块浏览关键帧",
          description: "用户浏览价格信息，但未触发任何转化动作。",
          severity: EvidenceSeverity.INFO,
          offsetMs: 24000,
        },
      ],
    },
  };

  for (const [journeyCode, story] of Object.entries(stories)) {
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
          regionSource: event.regionSource,
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
          isKeyEvent: event.isKeyEvent ?? true,
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
          imageUrl: evidence.imageUrl,
          content: evidence.content,
          offsetMs: evidence.offsetMs,
          capturedAt: new Date(journey.startedAt.getTime() + evidence.offsetMs),
        },
      });
    }
  }
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
