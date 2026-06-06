import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID_PATTERN = /^tnt_\d{6}_\d{3}$/;
const APPLICATION_ID_PATTERN = /^app_\d{6}_\d{3}$/;
const USER_ID_PATTERN = /^usr_\d{6}_\d{3}$/;
const USER_CODE_PATTERN = /^U-\d{6}-\d{3}$/;
const JOURNEY_ID_PATTERN = /^jny_\d{6}_\d{3}$/;
const JOURNEY_CODE_PATTERN = /^J-\d{6}-\d{3}$/;
const PROJECT_ID_PATTERN = /^prj_\d{6}_\d{3}$/;
const PROJECT_CODE_PATTERN = /^P-\d{6}-\d{3}$/;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkSummary(value, field, code, minLength = 18) {
  invariant((value ?? "").trim().length >= minLength, `${code} 的 ${field} 为空或信息不足`);
}

async function main() {
  const [tenants, applications, users, journeys, projects, tags] = await Promise.all([
    prisma.tenant.findMany({
      include: {
        applications: true,
        users: true,
        journeys: true,
        projects: true,
        tags: true,
      },
      orderBy: { slug: "asc" },
    }),
    prisma.application.findMany({
      include: {
        tenant: true,
      },
      orderBy: [{ tenant: { slug: "asc" } }, { name: "asc" }],
    }),
    prisma.user.findMany({
      include: {
        tenant: true,
        application: true,
        journeys: true,
      },
      orderBy: [{ tenant: { slug: "asc" } }, { externalId: "asc" }],
    }),
    prisma.journey.findMany({
      include: {
        tenant: true,
        application: true,
        user: true,
        journeyTags: {
          include: { tag: true },
        },
        events: true,
        evidences: true,
        projectJourneys: true,
      },
      orderBy: [{ tenant: { slug: "asc" } }, { journeyCode: "asc" }],
    }),
    prisma.project.findMany({
      include: {
        tenant: true,
        application: true,
        projectJourneys: {
          include: {
            journey: true,
          },
        },
      },
      orderBy: [{ tenant: { slug: "asc" } }, { projectCode: "asc" }],
    }),
    prisma.tag.findMany({
      include: {
        tenant: true,
        application: true,
      },
      orderBy: [{ tenant: { slug: "asc" } }, { type: "asc" }, { name: "asc" }],
    }),
  ]);

  invariant(tenants.length >= 3, "租户样本不足");
  invariant(applications.length >= 4, "应用样本不足");
  invariant(users.length >= 9, "用户样本不足");
  invariant(journeys.length >= 12, "旅程样本不足");
  invariant(projects.length >= 6, "项目样本不足");
  invariant(tags.length >= 18, "标签样本不足");

  for (const tenant of tenants) {
    invariant(TENANT_ID_PATTERN.test(tenant.id), `租户主键格式不规范: ${tenant.id}`);
    invariant(tenant.slug.length >= 3, `租户 slug 异常: ${tenant.slug}`);
    invariant(tenant.applications.length >= 1, `${tenant.slug} 没有应用`);
    invariant(tenant.users.length >= 3, `${tenant.slug} 的用户样本不足`);
    invariant(tenant.journeys.length >= 4, `${tenant.slug} 的旅程样本不足`);
    invariant(tenant.projects.length >= 1, `${tenant.slug} 的项目样本不足`);
    invariant(tenant.tags.length >= 6, `${tenant.slug} 的标签样本不足`);
  }

  for (const application of applications) {
    invariant(APPLICATION_ID_PATTERN.test(application.id), `应用主键格式不规范: ${application.id}`);
    invariant(application.tenantId === application.tenant.id, `${application.name} tenant 关系异常`);
    invariant(application.appKey.trim().length >= 6, `${application.name} appKey 过短`);
  }

  for (const user of users) {
    invariant(USER_ID_PATTERN.test(user.id), `用户主键格式不规范: ${user.id}`);
    invariant(USER_CODE_PATTERN.test(user.externalId), `用户展示 ID 格式不规范: ${user.externalId}`);
    invariant(user.tenantId === user.tenant.id, `${user.externalId} tenant 关系异常`);
    invariant(user.applicationId === user.application.id, `${user.externalId} application 关系异常`);
    invariant(user.tenantId === user.application.tenantId, `${user.externalId} 跨租户引用了应用`);
    invariant(user.journeys.length >= 1, `${user.externalId} 没有关联旅程`);
  }

  for (const journey of journeys) {
    invariant(JOURNEY_ID_PATTERN.test(journey.id), `旅程主键格式不规范: ${journey.id}`);
    invariant(JOURNEY_CODE_PATTERN.test(journey.journeyCode), `旅程展示 ID 格式不规范: ${journey.journeyCode}`);
    invariant(journey.tenantId === journey.tenant.id, `${journey.journeyCode} tenant 关系异常`);
    invariant(journey.applicationId === journey.application.id, `${journey.journeyCode} application 关系异常`);
    invariant(journey.userId === journey.user.id, `${journey.journeyCode} user 关系异常`);
    invariant(journey.tenantId === journey.user.tenantId, `${journey.journeyCode} 跨租户引用了用户`);
    invariant(journey.tenantId === journey.application.tenantId, `${journey.journeyCode} 跨租户引用了应用`);
    invariant(USER_CODE_PATTERN.test(journey.user.externalId), `${journey.journeyCode} 关联用户展示 ID 异常`);
    invariant(journey.totalDurationMs > 0, `${journey.journeyCode} 缺少总时长`);
    invariant(journey.effectiveDurationMs > 0, `${journey.journeyCode} 缺少有效时长`);
    invariant(journey.effectiveDurationMs <= journey.totalDurationMs, `${journey.journeyCode} 时长关系异常`);
    invariant(journey.events.length >= 2, `${journey.journeyCode} 关键时间线不足`);
    invariant(journey.journeyTags.length >= 1, `${journey.journeyCode} 缺少标签`);
    invariant(journey.aiSummaryShort.trim() !== "", `${journey.journeyCode} 缺少 AI 摘要`);

    checkSummary(journey.aiSummaryShort, "AI 一句话摘要", journey.journeyCode);
    checkSummary(journey.aiScenarioSummary, "使用场景还原", journey.journeyCode);
    checkSummary(journey.aiProcessSummary, "行为过程还原", journey.journeyCode);
    checkSummary(journey.aiGoalAnalysis, "目标达成分析", journey.journeyCode);
    checkSummary(journey.aiAnomalyAnalysis, "异常行为摘要", journey.journeyCode);

    const hasTimelineCoverage =
      journey.events.some((event) => event.type === "PAGE_VIEW") &&
      journey.events.some((event) =>
        ["BUSINESS_ACTION", "REQUEST", "EXIT", "FEEDBACK", "ANOMALY"].includes(event.type),
      );
    invariant(hasTimelineCoverage, `${journey.journeyCode} 缺少完整关键时间线类型`);

    if (journey.hasAnomaly || journey.resultStatus === "FAILED") {
      invariant(journey.evidences.length >= 1, `${journey.journeyCode} 异常样本缺少证据`);
      const hasFailureSignal =
        journey.events.some((event) => (event.statusCode ?? 0) >= 400) ||
        journey.evidences.some((evidence) =>
          ["NETWORK", "TOAST", "SCREENSHOT", "ERROR_NOTE", "DOM_SNAPSHOT"].includes(evidence.type),
        );
      invariant(hasFailureSignal, `${journey.journeyCode} 异常样本缺少失败信号`);
    }
  }

  for (const tag of tags) {
    invariant(tag.tenantId === tag.tenant.id, `${tag.name} tenant 关系异常`);
    invariant(tag.applicationId === tag.application.id, `${tag.name} application 关系异常`);
    invariant(tag.tenantId === tag.application.tenantId, `${tag.name} 跨租户引用了应用`);
  }

  for (const project of projects) {
    invariant(PROJECT_ID_PATTERN.test(project.id), `项目主键格式不规范: ${project.id}`);
    invariant(PROJECT_CODE_PATTERN.test(project.projectCode ?? ""), `项目展示 ID 格式不规范: ${project.projectCode}`);
    invariant(project.tenantId === project.tenant.id, `${project.projectCode} tenant 关系异常`);
    invariant(project.applicationId === project.application.id, `${project.projectCode} application 关系异常`);
    invariant(project.tenantId === project.application.tenantId, `${project.projectCode} 跨租户引用了应用`);
    invariant(project.projectJourneys.length >= 1, `${project.projectCode} 没有归档样本`);
    invariant(
      project.projectJourneys.every((item) => item.journey.tenantId === project.tenantId),
      `${project.projectCode} 归档了跨租户旅程`,
    );
  }

  const summary = {
    tenants: tenants.length,
    applications: applications.length,
    users: users.length,
    journeys: journeys.length,
    projects: projects.length,
    tags: tags.length,
    anomalyJourneys: journeys.filter((journey) => journey.hasAnomaly).length,
    browsingJourneys: journeys.filter((journey) => journey.resultStatus === "BROWSING").length,
    perTenant: tenants.map((tenant) => ({
      name: tenant.name,
      slug: tenant.slug,
      applications: tenant.applications.length,
      users: tenant.users.length,
      journeys: tenant.journeys.length,
      projects: tenant.projects.length,
      tags: tenant.tags.length,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
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
