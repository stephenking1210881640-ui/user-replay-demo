import {
  ApplicationStatus,
  EvidenceSeverity,
  EvidenceType,
  FindingCategory,
  JourneyEventType,
  JourneyResultStatus,
  PrismaClient,
  TagType,
} from "@prisma/client";

const prisma = new PrismaClient();
const now = new Date("2026-06-01T12:30:00.000Z");

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function hoursAgo(hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
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

  const application = await prisma.application.create({
    data: {
      name: "InsightFlow Commerce Demo",
      appKey: "if_demo_checkout_web",
      host: "demo.insightflow.app",
      description:
        "用于演示 Web 应用接入、用户旅程回放、AI 总结和研究项目沉淀的 Demo 空间。",
      status: ApplicationStatus.CONNECTED,
      createdAt: daysAgo(15),
      lastReportedAt: minutesAgo(3),
    },
  });

  const tagDefinitions = [
    { name: "高意向", type: TagType.USER, color: "#dbeafe", description: "近期存在明显转化意图" },
    { name: "价格敏感", type: TagType.USER, color: "#ffedd5", description: "对价格与优惠信息高度关注" },
    { name: "异常关注", type: TagType.USER, color: "#fee2e2", description: "最近 7 天频繁遭遇异常" },
    { name: "新用户", type: TagType.USER, color: "#dcfce7", description: "首次接触产品不久" },
    { name: "核心用户", type: TagType.USER, color: "#ede9fe", description: "高频、稳定使用者" },
    { name: "BI 分析师", type: TagType.USER, color: "#e0f2fe", description: "以分析任务为主的角色" },
    { name: "支付失败", type: TagType.JOURNEY, color: "#fee2e2", description: "支付相关技术失败" },
    { name: "优惠券困惑", type: TagType.JOURNEY, color: "#ffedd5", description: "优惠券反馈不清晰" },
    { name: "顺利完成", type: TagType.JOURNEY, color: "#dcfce7", description: "标准成功路径" },
    { name: "长停留", type: TagType.JOURNEY, color: "#fef3c7", description: "长时间停滞或犹豫" },
    { name: "仅浏览退出", type: TagType.JOURNEY, color: "#e2e8f0", description: "无明确转化动作" },
    { name: "中途放弃", type: TagType.JOURNEY, color: "#f1f5f9", description: "未完成核心任务即退出" },
  ] as const;

  const tags = await Promise.all(
    tagDefinitions.map((tag) =>
      prisma.tag.create({
        data: {
          ...tag,
          applicationId: application.id,
        },
      })
    )
  );

  const tagByName = Object.fromEntries(tags.map((tag) => [tag.name, tag]));

  const users = await Promise.all([
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-281149",
        name: "Mia Chen",
        email: "mia.chen@example.com",
        avatarSeed: "M",
        deviceType: "Desktop",
        os: "macOS 14.5",
        browser: "Chrome 125",
        location: "上海 · 中国",
        firstSeenAt: daysAgo(24),
        lastActiveAt: minutesAgo(2),
        userTags: {
          create: [{ tagId: tagByName["高意向"].id }, { tagId: tagByName["异常关注"].id }],
        },
      },
    }),
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-552874",
        name: "Leo Xu",
        email: "leo.xu@example.com",
        avatarSeed: "L",
        deviceType: "Desktop",
        os: "Windows 11",
        browser: "Edge 125",
        location: "杭州 · 中国",
        firstSeenAt: daysAgo(11),
        lastActiveAt: hoursAgo(2),
        userTags: {
          create: [{ tagId: tagByName["价格敏感"].id }, { tagId: tagByName["新用户"].id }],
        },
      },
    }),
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-110923",
        name: "Ada Lin",
        email: "ada.lin@example.com",
        avatarSeed: "A",
        deviceType: "Desktop",
        os: "macOS 14.5",
        browser: "Safari 17",
        location: "深圳 · 中国",
        firstSeenAt: daysAgo(58),
        lastActiveAt: hoursAgo(16),
        userTags: {
          create: [{ tagId: tagByName["核心用户"].id }, { tagId: tagByName["BI 分析师"].id }],
        },
      },
    }),
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-774218",
        name: "Ethan Wu",
        email: "ethan.wu@example.com",
        avatarSeed: "E",
        deviceType: "Mobile Web",
        os: "iOS 17",
        browser: "Safari Mobile",
        location: "北京 · 中国",
        firstSeenAt: daysAgo(6),
        lastActiveAt: hoursAgo(10),
        userTags: {
          create: [{ tagId: tagByName["新用户"].id }],
        },
      },
    }),
    prisma.user.create({
      data: {
        applicationId: application.id,
        externalId: "U-908112",
        name: "Nora Gao",
        email: "nora.gao@example.com",
        avatarSeed: "N",
        deviceType: "Desktop",
        os: "Windows 11",
        browser: "Chrome 125",
        location: "广州 · 中国",
        firstSeenAt: daysAgo(31),
        lastActiveAt: hoursAgo(4),
        userTags: {
          create: [{ tagId: tagByName["价格敏感"].id }, { tagId: tagByName["高意向"].id }],
        },
      },
    }),
  ]);

  const userByExternalId = Object.fromEntries(users.map((user) => [user.externalId, user]));

  const journeys = await Promise.all([
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-281149"].id,
        journeyCode: "J-948102",
        title: "结算页支付组件初始化失败",
        startedAt: hoursAgo(4),
        endedAt: new Date(hoursAgo(4).getTime() + 185000),
        totalDurationMs: 185000,
        effectiveDurationMs: 148000,
        pageCount: 4,
        keyActionCount: 11,
        requestCount: 7,
        resultStatus: JourneyResultStatus.FAILED,
        hasAnomaly: true,
        pageUrl: "https://demo.insightflow.app/checkout",
        pageTemplate: "/checkout",
        pageTitle: "订单结算",
        businessActionType: "支付提交",
        aiSummaryShort:
          "用户进入结算页后尝试提交订单，支付组件初始化失败，出现错误 toast 后停留 12 秒离开页面。",
        aiScenarioSummary:
          "用户本次旅程的核心目标是完成“提交订单并支付”，属于高意向结算场景。",
        aiProcessSummary:
          "用户依次完成购物车确认、地址确认和优惠券尝试，在点击“确认支付”后触发核心组件异常，后续页面无响应。",
        aiGoalAnalysis:
          "目标未达成。用户已完成支付前的关键前置动作，但支付组件在初始化阶段报错，直接阻断了支付提交。",
        aiAnomalyAnalysis:
          "存在代码级阻断异常：支付 SDK mount 失败，页面出现错误 toast，随后用户停滞 12 秒并退出页面。",
        journeyTags: {
          create: [{ tagId: tagByName["支付失败"].id }, { tagId: tagByName["优惠券困惑"].id }],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-552874"].id,
        journeyCode: "J-944871",
        title: "费用说明犹豫后中途放弃",
        startedAt: hoursAgo(5),
        endedAt: new Date(hoursAgo(5).getTime() + 312000),
        totalDurationMs: 312000,
        effectiveDurationMs: 205000,
        pageCount: 5,
        keyActionCount: 9,
        requestCount: 4,
        resultStatus: JourneyResultStatus.ABANDONED,
        hasAnomaly: false,
        pageUrl: "https://demo.insightflow.app/checkout",
        pageTemplate: "/checkout",
        pageTitle: "订单结算",
        businessActionType: "费用确认",
        aiSummaryShort:
          "用户反复查看运费与优惠金额明细，长时间停留后返回购物车，最终未进入支付提交。",
        aiScenarioSummary: "用户试图确认结算金额是否合理，目标偏向完成下单前的费用确认。",
        aiProcessSummary:
          "用户进入结算页后两次展开费用明细，并返回购物车修改商品数量，第二次进入后在应付总额区域停留较久后离开。",
        aiGoalAnalysis:
          "目标未达成。用户没有进入支付提交阶段，说明在费用理解与价格确认环节已出现明显阻塞。",
        aiAnomalyAnalysis:
          "无系统异常，但存在长停留、重复查看与路径回退，说明费用信息的理解成本较高。",
        journeyTags: {
          create: [{ tagId: tagByName["长停留"].id }, { tagId: tagByName["中途放弃"].id }],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-110923"].id,
        journeyCode: "J-939225",
        title: "标准结算路径顺利完成",
        startedAt: hoursAgo(15),
        endedAt: new Date(hoursAgo(15).getTime() + 156000),
        totalDurationMs: 156000,
        effectiveDurationMs: 141000,
        pageCount: 4,
        keyActionCount: 10,
        requestCount: 6,
        resultStatus: JourneyResultStatus.COMPLETED,
        hasAnomaly: false,
        pageUrl: "https://demo.insightflow.app/checkout",
        pageTemplate: "/checkout",
        pageTitle: "订单结算",
        businessActionType: "支付提交",
        aiSummaryShort:
          "用户首次进入新版结算页后快速完成地址确认、优惠券选择和支付提交，整个过程连续流畅。",
        aiScenarioSummary: "用户带着明确购买意图进入结算页，目标是完整完成订单支付。",
        aiProcessSummary:
          "用户从商品详情进入购物车，确认地址与优惠券后一次性完成支付提交流程，期间没有回退与重复操作。",
        aiGoalAnalysis:
          "目标已达成。关键动作链条连续，支付请求成功返回，用户随后到达支付成功页。",
        aiAnomalyAnalysis:
          "未发现异常请求、长停留或反复点击，可视为标准健康路径样本。",
        journeyTags: {
          create: [{ tagId: tagByName["顺利完成"].id }],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-908112"].id,
        journeyCode: "J-951774",
        title: "优惠券反馈不清导致反复尝试",
        startedAt: hoursAgo(3),
        endedAt: new Date(hoursAgo(3).getTime() + 228000),
        totalDurationMs: 228000,
        effectiveDurationMs: 174000,
        pageCount: 4,
        keyActionCount: 13,
        requestCount: 5,
        resultStatus: JourneyResultStatus.ABANDONED,
        hasAnomaly: false,
        pageUrl: "https://demo.insightflow.app/checkout",
        pageTemplate: "/checkout",
        pageTitle: "订单结算",
        businessActionType: "优惠券选择",
        aiSummaryShort:
          "用户连续点击优惠券入口 4 次但未获得明确可用反馈，随后关闭结算页，中途放弃支付。",
        aiScenarioSummary:
          "用户本次主要目标是完成优惠抵扣与支付前确认，属于高转化意图但高反馈敏感场景。",
        aiProcessSummary:
          "用户在地址确认后多次打开优惠券抽屉并反复切换可用券列表，未看到成功反馈，最终直接退出结算流程。",
        aiGoalAnalysis:
          "目标未达成。用户在支付前的优惠券选择阶段出现理解与反馈阻塞，没有进入最终支付提交。",
        aiAnomalyAnalysis:
          "无系统报错，但存在连续重复点击与明显反馈缺失，属于交互设计问题。",
        journeyTags: {
          create: [{ tagId: tagByName["优惠券困惑"].id }, { tagId: tagByName["中途放弃"].id }],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-774218"].id,
        journeyCode: "J-932610",
        title: "仅浏览商品与评价后退出",
        startedAt: daysAgo(1),
        endedAt: new Date(daysAgo(1).getTime() + 96000),
        totalDurationMs: 96000,
        effectiveDurationMs: 72000,
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
          "用户主要浏览商品详情和评价区域，无明确转化动作后离开页面，属于轻量信息探索型旅程。",
        aiScenarioSummary:
          "用户处于早期探索阶段，本次更像信息收集而非明确购买决策。",
        aiProcessSummary:
          "用户浏览商品卖点、价格和评价模块，未加入购物车，也未触发结算相关动作，随后关闭页面。",
        aiGoalAnalysis:
          "无法判定存在明确成交目标，但可以确认未进入任何转化链路，停留在浏览层。",
        aiAnomalyAnalysis:
          "没有技术异常。主要特征是停留短、动作少、缺乏推进到下一步的意图。",
        journeyTags: {
          create: [{ tagId: tagByName["仅浏览退出"].id }],
        },
      },
    }),
    prisma.journey.create({
      data: {
        applicationId: application.id,
        userId: userByExternalId["U-110923"].id,
        journeyCode: "J-930115",
        title: "新手引导配置顺利完成",
        startedAt: daysAgo(2),
        endedAt: new Date(daysAgo(2).getTime() + 214000),
        totalDurationMs: 214000,
        effectiveDurationMs: 199000,
        pageCount: 6,
        keyActionCount: 14,
        requestCount: 5,
        resultStatus: JourneyResultStatus.COMPLETED,
        hasAnomaly: false,
        pageUrl: "https://demo.insightflow.app/onboarding",
        pageTemplate: "/onboarding",
        pageTitle: "新手引导",
        businessActionType: "初始化配置",
        aiSummaryShort:
          "用户顺利完成了新手引导流程，并在设置页成功配置了基础信息，期间在权限管理页面停留较久。",
        aiScenarioSummary: "用户目标是完成账户初始化设置，属于首次成功上手场景。",
        aiProcessSummary:
          "用户依次完成组织信息、权限配置和通知设置，最终进入工作台首页。",
        aiGoalAnalysis: "目标已达成。虽在权限步骤停留略久，但没有造成回退或放弃。",
        aiAnomalyAnalysis: "未见明显异常，仅建议继续观察权限文案理解成本。",
        journeyTags: {
          create: [{ tagId: tagByName["顺利完成"].id }],
        },
      },
    }),
  ]);

  const journeyByCode = Object.fromEntries(journeys.map((journey) => [journey.journeyCode, journey]));

  const projectCheckout = await prisma.project.create({
    data: {
      applicationId: application.id,
      name: "新结算页可用性验证",
      goal:
        "验证新版结算页是否被用户正确理解与顺利使用，重点分析地址填写、优惠券使用、费用理解与支付提交等关键节点。",
      focusArea: "结算与支付体验",
      ownerName: "林晓雯",
      description:
        "该研究项目聚焦新版结算页在真实环境中的可理解性与可完成性，目标是识别阻断行为与信息理解偏差，并为产品优化提供证据。",
      filterTimeRangeLabel: "近 7 天",
      filterPageTemplates: "/checkout, /address, /payment",
      filterStatuses: "未完成, 异常中断, 长停留",
      filterTagRules: "优惠券失败, 费用疑惑, 重复返回, 支付前放弃",
      createdAt: daysAgo(4),
    },
  });

  const projectOnboarding = await prisma.project.create({
    data: {
      applicationId: application.id,
      name: "新手引导转化观察",
      goal: "观察新用户是否能顺利完成初始化配置并进入首次有效使用。",
      focusArea: "Onboarding 转化",
      ownerName: "周亦凡",
      description:
        "该项目用于收集新手引导的成功与失败样本，观察用户在权限配置、组织信息和工作台进入环节的理解阻塞。",
      filterTimeRangeLabel: "近 14 天",
      filterPageTemplates: "/onboarding, /settings",
      filterStatuses: "已完成, 中途放弃",
      filterTagRules: "新用户, 长停留",
      createdAt: daysAgo(7),
    },
  });

  await prisma.projectJourney.createMany({
    data: [
      { projectId: projectCheckout.id, journeyId: journeyByCode["J-948102"].id, addedAt: hoursAgo(2) },
      { projectId: projectCheckout.id, journeyId: journeyByCode["J-944871"].id, addedAt: hoursAgo(3) },
      { projectId: projectCheckout.id, journeyId: journeyByCode["J-939225"].id, addedAt: daysAgo(1) },
      { projectId: projectCheckout.id, journeyId: journeyByCode["J-951774"].id, addedAt: hoursAgo(4) },
      { projectId: projectOnboarding.id, journeyId: journeyByCode["J-930115"].id, addedAt: daysAgo(2) },
    ],
  });

  await prisma.projectFinding.createMany({
    data: [
      {
        projectId: projectCheckout.id,
        title: "费用说明理解成本偏高，是用户停滞的主要原因",
        summary:
          "在纳入样本中，用户经常在“应付总额 / 运费 / 优惠抵扣”区域出现长停留与重复查看，说明新版信息布局未能建立即时理解。",
        category: FindingCategory.INSIGHT,
        evidenceJourneyCount: 14,
        sortOrder: 1,
      },
      {
        projectId: projectCheckout.id,
        title: "优惠券入口反馈不足，导致用户反复尝试",
        summary:
          "多条旅程显示用户点击优惠券入口后未能立即获得可用状态或结果反馈，出现重复点击、返回上一层重新进入等行为。",
        category: FindingCategory.INTERACTION,
        evidenceJourneyCount: 9,
        sortOrder: 2,
      },
      {
        projectId: projectCheckout.id,
        title: "支付前的技术异常会直接中断高意图用户",
        summary:
          "少量高意图用户已经完成全部前置动作，但在支付组件加载与提交阶段触发前端报错后直接退出，应优先修复。",
        category: FindingCategory.TECHNICAL,
        evidenceJourneyCount: 3,
        sortOrder: 3,
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
        message: "收到 page_view 事件，页面模板识别成功",
        payloadSummary: "/checkout · page_title=订单结算",
        createdAt: minutesAgo(3),
      },
      {
        applicationId: application.id,
        level: "info",
        status: "已写入",
        source: "collector.network",
        message: "链路事件已聚合进旅程 J-948102",
        payloadSummary: "request_count=7 · effective_ms=148000",
        createdAt: minutesAgo(4),
      },
      {
        applicationId: application.id,
        level: "warn",
        status: "部分降级",
        source: "region-recognizer",
        message: "1 条 region 识别回退到 anchor 文本模式",
        payloadSummary: "button[text=确认支付]",
        createdAt: minutesAgo(6),
      },
      {
        applicationId: application.id,
        level: "error",
        status: "异常",
        source: "sdk.runtime",
        message: "recordNetwork 插件上报 1 条支付 SDK 初始化错误",
        payloadSummary: "TypeError: cannot read properties of undefined",
        createdAt: minutesAgo(7),
      },
      {
        applicationId: application.id,
        level: "info",
        status: "已校验",
        source: "validator",
        message: "最近 24 小时旅程数与活跃用户数已刷新",
        payloadSummary: "journeys=28 · users=16",
        createdAt: minutesAgo(9),
      },
    ],
  });

  const eventSeed = [
    {
      journeyCode: "J-948102",
      items: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入结算页",
          description: "用户从购物车进入结算页，开始确认地址和订单信息。",
          pageUrl: "https://demo.insightflow.app/checkout",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
          businessIntent: "确认订单",
        },
        {
          seq: 2,
          offsetMs: 26000,
          type: JourneyEventType.REGION_ACTION,
          title: "展开优惠券面板",
          description: "用户点击“优惠券”入口，尝试查看可用优惠。",
          region: "order-summary.coupon-entry",
          regionSource: "dom-anchor",
          uiAction: "click",
          businessAction: "查看优惠券",
          businessIntent: "降低支付金额",
          targetLabel: "优惠券",
        },
        {
          seq: 3,
          offsetMs: 64000,
          type: JourneyEventType.REQUEST,
          title: "支付准备请求成功",
          description: "结算信息与支付前置数据加载完成。",
          requestHost: "api.demo.insightflow.app",
          method: "POST",
          pathTemplate: "/api/checkout/prepare",
          statusCode: 200,
          durationMs: 382,
          requestOutcome: "success",
        },
        {
          seq: 4,
          offsetMs: 104000,
          type: JourneyEventType.BUSINESS_ACTION,
          title: "点击确认支付",
          description: "用户在结算页点击主 CTA，尝试发起支付。",
          region: "checkout.primary-action",
          regionSource: "component-tree",
          uiAction: "click",
          businessAction: "提交支付",
          businessIntent: "完成支付",
          targetLabel: "确认支付",
        },
        {
          seq: 5,
          offsetMs: 106000,
          type: JourneyEventType.ANOMALY,
          title: "支付组件初始化失败",
          description: "支付 SDK 在 mount 阶段抛出 TypeError，页面无响应。",
          region: "payment-sdk.mount",
          uiFeedback: "toast.error",
          isAnomaly: true,
          requestOutcome: "blocked_by_js_error",
        },
        {
          seq: 6,
          offsetMs: 118000,
          type: JourneyEventType.EXIT,
          title: "用户关闭页面",
          description: "异常出现后用户停滞 12 秒，随后关闭标签页。",
          isAnomaly: true,
        },
      ],
    },
    {
      journeyCode: "J-944871",
      items: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入结算页",
          description: "用户从购物车进入结算页查看订单费用。",
          pageUrl: "https://demo.insightflow.app/checkout",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 2,
          offsetMs: 47000,
          type: JourneyEventType.REGION_ACTION,
          title: "查看运费说明",
          description: "用户展开运费说明，阅读费用构成。",
          region: "order-summary.shipping-fee",
          uiAction: "click",
          businessAction: "查看费用解释",
          targetLabel: "运费说明",
        },
        {
          seq: 3,
          offsetMs: 123000,
          type: JourneyEventType.STATE_CHANGE,
          title: "返回购物车修改数量",
          description: "用户认为费用偏高，返回购物车减少商品数量。",
          businessAction: "修改购物车",
        },
        {
          seq: 4,
          offsetMs: 248000,
          type: JourneyEventType.EXIT,
          title: "停留后退出",
          description: "用户在应付总额区域停留较久，未进入支付提交流程。",
        },
      ],
    },
    {
      journeyCode: "J-939225",
      items: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入结算页",
          description: "用户进入结算流程。",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 2,
          offsetMs: 38000,
          type: JourneyEventType.REGION_ACTION,
          title: "确认地址信息",
          description: "用户快速确认收货地址。",
          region: "address-card",
          uiAction: "click",
          businessAction: "确认地址",
        },
        {
          seq: 3,
          offsetMs: 94000,
          type: JourneyEventType.REQUEST,
          title: "支付请求成功",
          description: "支付请求返回成功状态。",
          requestHost: "api.demo.insightflow.app",
          method: "POST",
          pathTemplate: "/api/payment/submit",
          statusCode: 200,
          durationMs: 612,
          requestOutcome: "success",
        },
        {
          seq: 4,
          offsetMs: 132000,
          type: JourneyEventType.STATE_CHANGE,
          title: "进入支付成功页",
          description: "页面成功跳转到支付完成状态。",
          pageTemplate: "/payment/success",
          pageTitle: "支付成功",
        },
      ],
    },
    {
      journeyCode: "J-951774",
      items: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入结算页",
          description: "用户进入结算页准备使用优惠券。",
          pageTemplate: "/checkout",
          pageTitle: "订单结算",
        },
        {
          seq: 2,
          offsetMs: 29000,
          type: JourneyEventType.REGION_ACTION,
          title: "多次点击优惠券入口",
          description: "用户 4 次点击优惠券入口，但未看到明显反馈。",
          region: "coupon-drawer-trigger",
          uiAction: "multi_click",
          businessAction: "尝试选择优惠券",
          targetLabel: "优惠券入口",
        },
        {
          seq: 3,
          offsetMs: 97000,
          type: JourneyEventType.FEEDBACK,
          title: "反馈弱提示",
          description: "页面仅出现轻量提示，没有展示券是否应用成功。",
          uiFeedback: "subtle.badge",
        },
        {
          seq: 4,
          offsetMs: 170000,
          type: JourneyEventType.EXIT,
          title: "用户离开结算页",
          description: "用户没有进入支付动作，直接关闭了结算页。",
        },
      ],
    },
    {
      journeyCode: "J-932610",
      items: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入商品详情页",
          description: "用户进入商品详情进行信息浏览。",
          pageTemplate: "/products/[slug]",
          pageTitle: "Insight Pro 商品详情",
        },
        {
          seq: 2,
          offsetMs: 18000,
          type: JourneyEventType.REGION_ACTION,
          title: "查看评价区域",
          description: "用户滚动到用户评价区阅读评价内容。",
          region: "product-review-section",
          uiAction: "scroll",
          businessAction: "阅读评价",
        },
        {
          seq: 3,
          offsetMs: 62000,
          type: JourneyEventType.EXIT,
          title: "浏览后退出",
          description: "未发生加入购物车或收藏等转化动作。",
        },
      ],
    },
    {
      journeyCode: "J-930115",
      items: [
        {
          seq: 1,
          offsetMs: 0,
          type: JourneyEventType.PAGE_VIEW,
          title: "进入新手引导",
          description: "用户开始初始化配置流程。",
          pageTemplate: "/onboarding",
          pageTitle: "新手引导",
        },
        {
          seq: 2,
          offsetMs: 54000,
          type: JourneyEventType.STATE_CHANGE,
          title: "填写组织信息",
          description: "用户完成组织名称与成员规模配置。",
          businessAction: "组织初始化",
        },
        {
          seq: 3,
          offsetMs: 116000,
          type: JourneyEventType.REQUEST,
          title: "保存权限设置成功",
          description: "权限配置请求成功返回。",
          requestHost: "api.demo.insightflow.app",
          method: "POST",
          pathTemplate: "/api/settings/permissions",
          statusCode: 200,
          durationMs: 420,
          requestOutcome: "success",
        },
        {
          seq: 4,
          offsetMs: 182000,
          type: JourneyEventType.STATE_CHANGE,
          title: "进入工作台首页",
          description: "引导完成，用户成功进入工作台首页。",
          pageTemplate: "/workspace",
          pageTitle: "工作台",
        },
      ],
    },
  ] as const;

  for (const entry of eventSeed) {
    const journey = journeyByCode[entry.journeyCode];
    for (const item of entry.items) {
      await prisma.journeyEvent.create({
        data: {
          journeyId: journey.id,
          occurredAt: new Date(journey.startedAt.getTime() + item.offsetMs),
          ...item,
        },
      });
    }
  }

  const anomalyEvent = await prisma.journeyEvent.findFirstOrThrow({
    where: { journeyId: journeyByCode["J-948102"].id, title: "支付组件初始化失败" },
  });

  await prisma.evidence.createMany({
    data: [
      {
        journeyId: journeyByCode["J-948102"].id,
        journeyEventId: anomalyEvent.id,
        type: EvidenceType.TOAST,
        title: "错误 Toast",
        description: "支付组件初始化失败的即时反馈。",
        severity: EvidenceSeverity.CRITICAL,
        content: "TypeError: Cannot read properties of undefined (reading 'mount')",
        capturedAt: new Date(journeyByCode["J-948102"].startedAt.getTime() + 106000),
        offsetMs: 106000,
      },
      {
        journeyId: journeyByCode["J-948102"].id,
        journeyEventId: anomalyEvent.id,
        type: EvidenceType.NETWORK,
        title: "支付准备请求日志",
        description: "支付准备请求返回成功，但前端组件 mount 阶段失败。",
        severity: EvidenceSeverity.WARNING,
        content: "POST /api/checkout/prepare 200 · duration=382ms",
        capturedAt: new Date(journeyByCode["J-948102"].startedAt.getTime() + 64000),
        offsetMs: 64000,
      },
      {
        journeyId: journeyByCode["J-948102"].id,
        journeyEventId: anomalyEvent.id,
        type: EvidenceType.ERROR_NOTE,
        title: "前端错误摘要",
        description: "支付 SDK 容器不存在，mount 调用失败。",
        severity: EvidenceSeverity.CRITICAL,
        content:
          "payment-sdk.tsx:87 -> mount(container) // container undefined",
        capturedAt: new Date(journeyByCode["J-948102"].startedAt.getTime() + 107000),
        offsetMs: 107000,
      },
      {
        journeyId: journeyByCode["J-944871"].id,
        type: EvidenceType.SCREENSHOT,
        title: "费用说明区停留截图",
        description: "用户在运费与优惠抵扣说明区域停留较久。",
        severity: EvidenceSeverity.INFO,
        capturedAt: new Date(journeyByCode["J-944871"].startedAt.getTime() + 161000),
        offsetMs: 161000,
      },
      {
        journeyId: journeyByCode["J-951774"].id,
        type: EvidenceType.DOM_SNAPSHOT,
        title: "优惠券状态轻反馈",
        description: "页面只有弱提示，无成功应用确认文案。",
        severity: EvidenceSeverity.WARNING,
        content: "<span class='coupon-tip'>已刷新可用优惠</span>",
        capturedAt: new Date(journeyByCode["J-951774"].startedAt.getTime() + 97000),
        offsetMs: 97000,
      },
    ],
  });

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

