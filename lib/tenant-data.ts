import {
  ApplicationStatus,
  JourneyResultStatus,
  Prisma,
  TagSource,
  TagType,
  TenantPlan,
  TenantStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type SearchParamValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamValue>;

function readParam(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function buildStartDate(range?: string) {
  const now = new Date();
  if (!range || range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (range === "24h") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  if (range === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (range === "14d") {
    return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  }
  return undefined;
}

function splitCriteria(value?: string | null) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureNarrativeText(value: string | null | undefined, fallback: string, minLength = 12) {
  const normalized = value?.trim() ?? "";
  if (normalized.length >= minLength) {
    return normalized;
  }
  return fallback;
}

function normalizeJourneyNarrative<
  T extends {
    title: string;
    pageTitle: string;
    pageTemplate: string;
    businessActionType: string;
    resultStatus: JourneyResultStatus;
    hasAnomaly: boolean;
    aiSummaryShort: string;
    aiScenarioSummary: string;
    aiProcessSummary: string;
    aiGoalAnalysis: string;
    aiAnomalyAnalysis: string;
  },
>(journey: T): T {
  const statusLabel = journeyStatusLabelMap[journey.resultStatus];
  const anomalyLabel = journey.hasAnomaly ? "过程中出现了明确异常信号。" : "过程中未出现系统级异常。";

  return {
    ...journey,
    aiSummaryShort: ensureNarrativeText(
      journey.aiSummaryShort,
      `${journey.title}，页面为 ${journey.pageTitle}，核心业务动作是${journey.businessActionType}，最终状态为${statusLabel}。`,
      18,
    ),
    aiScenarioSummary: ensureNarrativeText(
      journey.aiScenarioSummary,
      `用户进入 ${journey.pageTemplate} 页面，核心目标围绕“${journey.businessActionType}”展开，本次旅程适合作为 ${statusLabel} 旅程观察。`,
      18,
    ),
    aiProcessSummary: ensureNarrativeText(
      journey.aiProcessSummary,
      `用户在 ${journey.pageTitle} 中完成了关键浏览与操作动作，随后进入结果确认阶段，形成一条可回放的业务链路。`,
      18,
    ),
    aiGoalAnalysis: ensureNarrativeText(
      journey.aiGoalAnalysis,
      `本次旅程最终结果为${statusLabel}，可直接结合关键时间线与证据区判断目标是否达成以及阻断点位置。`,
      18,
    ),
    aiAnomalyAnalysis: ensureNarrativeText(journey.aiAnomalyAnalysis, anomalyLabel, 18),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDatabaseError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["P1001", "P2024"].includes((error as { code?: string }).code ?? "")
  );
}

async function withDbRetry<T>(task: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await task();
    } catch (error) {
      if (!isRetryableDatabaseError(error) || attempt >= retries) {
        throw error;
      }
      attempt += 1;
      await sleep(1200 * attempt);
    }
  }
}

async function findManyWithRetry<T>(task: () => Promise<T>) {
  return withDbRetry(task);
}

async function countWithRetry(task: () => Promise<number>) {
  return withDbRetry(task);
}

export async function getDefaultTenantSlug() {
  const tenant = await withDbRetry(() =>
    prisma.tenant.findFirst({
      orderBy: { createdAt: "asc" },
      select: { slug: true },
    }),
  );

  return tenant?.slug ?? null;
}

export async function getTenantShellBySlug(slug: string) {
  return withDbRetry(() =>
    prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        industry: true,
        plan: true,
        status: true,
        description: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            applications: true,
            users: true,
            journeys: true,
            projects: true,
            tags: true,
          },
        },
      },
    }),
  );
}

async function getTenantOrThrow(slug: string) {
  return withDbRetry(() =>
    prisma.tenant.findUniqueOrThrow({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        industry: true,
        plan: true,
        status: true,
        description: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  );
}

export async function getTenantList(searchParams?: SearchParams) {
  const status = readParam(searchParams?.status);
  const where: Prisma.TenantWhereInput = {
    ...(status && status !== "all" ? { status: status as TenantStatus } : {}),
  };

  const last7dStart = buildStartDate("7d")!;
  const tenants = await findManyWithRetry(() =>
    prisma.tenant.findMany({
      where,
      include: {
        _count: {
          select: {
            applications: true,
            journeys: true,
          },
        },
        users: {
          where: {
            lastActiveAt: { gte: last7dStart },
          },
          select: {
            id: true,
            lastActiveAt: true,
          },
          orderBy: { lastActiveAt: "desc" },
        },
        journeys: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            startedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  );

  return tenants.map((tenant) => ({
    ...tenant,
    activeUserCount: tenant.users.length,
    recentActiveAt: tenant.users[0]?.lastActiveAt ?? tenant.journeys[0]?.startedAt ?? tenant.updatedAt,
  }));
}

export async function getTenantOverviewData(tenantSlug: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const last7dStart = buildStartDate("7d")!;

  const [journeys, recentProjects, recentActiveUsers, appCount, projectCount] = await Promise.all([
    findManyWithRetry(() =>
      prisma.journey.findMany({
        where: {
          tenantId: tenant.id,
          startedAt: { gte: last7dStart },
        },
        include: {
          user: true,
          journeyTags: {
            include: { tag: true },
          },
        },
        orderBy: { startedAt: "desc" },
      }),
    ),
    findManyWithRetry(() =>
      prisma.project.findMany({
        where: { tenantId: tenant.id },
        include: {
          _count: {
            select: { projectJourneys: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
    ),
    findManyWithRetry(() =>
      prisma.user.findMany({
        where: {
          tenantId: tenant.id,
          lastActiveAt: { gte: last7dStart },
        },
        include: {
          _count: {
            select: { journeys: true },
          },
          userTags: {
            include: { tag: true },
          },
        },
        orderBy: { lastActiveAt: "desc" },
        take: 5,
      }),
    ),
    countWithRetry(() =>
      prisma.application.count({
        where: { tenantId: tenant.id },
      }),
    ),
    countWithRetry(() =>
      prisma.project.count({
        where: { tenantId: tenant.id },
      }),
    ),
  ]);

  const normalizedJourneys = journeys.map(normalizeJourneyNarrative);
  const successCount = normalizedJourneys.filter((journey) => journey.resultStatus === "COMPLETED").length;
  const anomalyCount = normalizedJourneys.filter((journey) => journey.hasAnomaly).length;
  const unfinishedCount = normalizedJourneys.filter(
    (journey) => journey.resultStatus === "ABANDONED" || journey.resultStatus === "BROWSING",
  ).length;
  const abnormalJourneys = normalizedJourneys
    .filter((journey) => journey.hasAnomaly || journey.resultStatus !== "COMPLETED")
    .slice(0, 4);
  const recentProblemPages = normalizedJourneys
    .filter((journey) => journey.hasAnomaly || journey.resultStatus !== "COMPLETED")
    .map((journey) => journey.pageTitle)
    .slice(0, 3);

  const insight = recentProblemPages.length
    ? `${tenant.name} 最近的高风险旅程主要集中在 ${recentProblemPages.join("、")}，建议优先查看异常旅程与对应研究项目。`
    : `${tenant.name} 最近 7 天暂无明显异常旅程，建议对比已完成旅程与长停留旅程，继续定位理解成本问题。`;

  return {
    tenant,
    metrics: {
      applicationCount: appCount,
      projectCount,
      activeUserCount: recentActiveUsers.length,
      last7dJourneyCount: normalizedJourneys.length,
      successCount,
      anomalyCount,
      unfinishedCount,
      successRate: normalizedJourneys.length ? Math.round((successCount / normalizedJourneys.length) * 100) : 0,
    },
    recentAnomalyJourneys: abnormalJourneys,
    recentProjects,
    recentActiveUsers,
    insight,
  };
}

export async function getTenantApplications(tenantSlug: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const last7dStart = buildStartDate("7d")!;

  const applications = await findManyWithRetry(() =>
    prisma.application.findMany({
      where: { tenantId: tenant.id },
      include: {
        _count: {
          select: {
            users: true,
            journeys: true,
            projects: true,
          },
        },
        users: {
          where: {
            lastActiveAt: { gte: last7dStart },
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  );

  return {
    tenant,
    applications: applications.map((application) => ({
      ...application,
      activeUserCount: application.users.length,
    })),
  };
}

export async function getTenantApplicationDetail(tenantSlug: string, appId: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const application = await withDbRetry(() =>
    prisma.application.findFirst({
      where: {
        tenantId: tenant.id,
        id: appId,
      },
      include: {
        integrationLogs: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    }),
  );

  if (!application) {
    return null;
  }

  const last24hStart = buildStartDate("24h")!;
  const [journeyCount24h, activeUsers24h, recentProjects] = await Promise.all([
    countWithRetry(() =>
      prisma.journey.count({
        where: {
          tenantId: tenant.id,
          applicationId: application.id,
          startedAt: { gte: last24hStart },
        },
      }),
    ),
    countWithRetry(() =>
      prisma.user.count({
        where: {
          tenantId: tenant.id,
          applicationId: application.id,
          lastActiveAt: { gte: last24hStart },
        },
      }),
    ),
    findManyWithRetry(() =>
      prisma.project.findMany({
        where: {
          tenantId: tenant.id,
          applicationId: application.id,
        },
        include: {
          _count: {
            select: { projectJourneys: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
    ),
  ]);

  return {
    tenant,
    application,
    journeyCount24h,
    activeUsers24h,
    recentProjects,
  };
}

export async function getTenantUsers(tenantSlug: string, searchParams: SearchParams) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const query = readParam(searchParams.query);
  const tag = readParam(searchParams.tag);
  const device = readParam(searchParams.device);
  const os = readParam(searchParams.os);
  const activeRange = readParam(searchParams.activeRange);

  const activeStart = buildStartDate(activeRange);
  const where: Prisma.UserWhereInput = {
    tenantId: tenant.id,
    ...(query
      ? {
          OR: [
            { externalId: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(device && device !== "all" ? { deviceType: device } : {}),
    ...(os && os !== "all" ? { os: { contains: os, mode: "insensitive" } } : {}),
    ...(activeStart ? { lastActiveAt: { gte: activeStart } } : {}),
    ...(tag && tag !== "all"
      ? {
          userTags: {
            some: {
              tag: {
                name: tag,
                type: TagType.USER,
                tenantId: tenant.id,
              },
            },
          },
        }
      : {}),
  };

  const users = await findManyWithRetry(() =>
    prisma.user.findMany({
      where,
      include: {
        application: true,
        userTags: {
          include: { tag: true },
        },
        journeys: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
        _count: {
          select: { journeys: true },
        },
      },
      orderBy: { lastActiveAt: "desc" },
    }),
  );
  const availableTags = await findManyWithRetry(() =>
    prisma.tag.findMany({
      where: { tenantId: tenant.id, type: TagType.USER },
      orderBy: { name: "asc" },
    }),
  );

  return {
    tenant,
    users: users.map((user) => ({
      ...user,
      journeys: user.journeys.map(normalizeJourneyNarrative),
    })),
    availableTags,
  };
}

export async function getTenantUserDetailShell(tenantSlug: string, userId: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const user = await withDbRetry(() =>
    prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        id: userId,
      },
      select: {
        id: true,
        tenantId: true,
        externalId: true,
        name: true,
        email: true,
        deviceType: true,
        os: true,
        browser: true,
        location: true,
        firstSeenAt: true,
        lastActiveAt: true,
        application: {
          select: {
            id: true,
            name: true,
          },
        },
        userTags: {
          include: {
            tag: true,
          },
        },
        journeys: {
          orderBy: { startedAt: "desc" },
          take: 1,
          include: {
            journeyTags: {
              include: { tag: true },
            },
          },
        },
        _count: {
          select: {
            journeys: true,
          },
        },
      },
    }),
  );

  return user
    ? {
        tenant,
        user: {
          ...user,
          journeys: user.journeys.map(normalizeJourneyNarrative),
        },
      }
    : null;
}

export async function getTenantUserDetail(tenantSlug: string, userId: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const user = await withDbRetry(() =>
    prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        id: userId,
      },
      include: {
        application: true,
        userTags: {
          include: { tag: true },
        },
        journeys: {
          include: {
            journeyTags: {
              include: { tag: true },
            },
          },
          orderBy: { startedAt: "desc" },
        },
      },
    }),
  );

  if (!user) {
    return null;
  }

  const availableTags = await findManyWithRetry(() =>
    prisma.tag.findMany({
      where: {
        tenantId: tenant.id,
        type: TagType.USER,
        userTags: {
          none: { userId: user.id },
        },
      },
      orderBy: { name: "asc" },
    }),
  );

  return {
    tenant,
    user: {
      ...user,
      journeys: user.journeys.map(normalizeJourneyNarrative),
    },
    availableTags,
  };
}

export async function getTenantJourneys(tenantSlug: string, searchParams: SearchParams) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const range = readParam(searchParams.range);
  const userId = readParam(searchParams.userId);
  const userTag = readParam(searchParams.userTag);
  const journeyTag = readParam(searchParams.journeyTag);
  const pageTemplate = readParam(searchParams.pageTemplate);
  const resultStatus = readParam(searchParams.resultStatus);
  const hasAnomaly = readParam(searchParams.hasAnomaly);
  const businessActionType = readParam(searchParams.businessActionType);

  const startedAfter = buildStartDate(range);
  const where: Prisma.JourneyWhereInput = {
    tenantId: tenant.id,
    ...(startedAfter ? { startedAt: { gte: startedAfter } } : {}),
    ...(userId ? { user: { externalId: { contains: userId, mode: "insensitive" } } } : {}),
    ...(userTag && userTag !== "all"
      ? {
          user: {
            userTags: {
              some: {
                tag: {
                  name: userTag,
                  type: TagType.USER,
                  tenantId: tenant.id,
                },
              },
            },
          },
        }
      : {}),
    ...(journeyTag && journeyTag !== "all"
      ? {
          journeyTags: {
            some: {
              tag: {
                name: journeyTag,
                type: TagType.JOURNEY,
                tenantId: tenant.id,
              },
            },
          },
        }
      : {}),
    ...(pageTemplate && pageTemplate !== "all" ? { pageTemplate } : {}),
    ...(businessActionType && businessActionType !== "all" ? { businessActionType } : {}),
    ...(hasAnomaly === "true" ? { hasAnomaly: true } : {}),
    ...(hasAnomaly === "false" ? { hasAnomaly: false } : {}),
    ...(resultStatus && resultStatus !== "all"
      ? { resultStatus: resultStatus as JourneyResultStatus }
      : {}),
  };

  const [journeys, userTags, journeyTags, projects] = await Promise.all([
    findManyWithRetry(() =>
      prisma.journey.findMany({
        where,
        include: {
          application: true,
          user: true,
          journeyTags: {
            include: { tag: true },
          },
          projectJourneys: {
            include: {
              project: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
      }),
    ),
    findManyWithRetry(() =>
      prisma.tag.findMany({
        where: { tenantId: tenant.id, type: TagType.USER },
        orderBy: { name: "asc" },
      }),
    ),
    findManyWithRetry(() =>
      prisma.tag.findMany({
        where: { tenantId: tenant.id, type: TagType.JOURNEY },
        orderBy: { name: "asc" },
      }),
    ),
    findManyWithRetry(() =>
      prisma.project.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          goal: true,
        },
      }),
    ),
  ]);

  return {
    tenant,
    journeys: journeys.map(normalizeJourneyNarrative),
    userTags,
    journeyTags,
    projects,
  };
}

export async function getTenantJourneyDetailShell(tenantSlug: string, journeyId: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const journey = await withDbRetry(() =>
    prisma.journey.findFirst({
      where: {
        tenantId: tenant.id,
        id: journeyId,
      },
      select: {
        id: true,
        journeyCode: true,
        title: true,
        startedAt: true,
        endedAt: true,
        totalDurationMs: true,
        effectiveDurationMs: true,
        resultStatus: true,
        hasAnomaly: true,
        pageTemplate: true,
        pageTitle: true,
        businessActionType: true,
        aiSummaryShort: true,
        aiScenarioSummary: true,
        aiProcessSummary: true,
        aiGoalAnalysis: true,
        aiAnomalyAnalysis: true,
        application: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            externalId: true,
            name: true,
          },
        },
        journeyTags: {
          include: {
            tag: true,
          },
        },
        events: {
          orderBy: { seq: "asc" },
          take: 5,
          select: {
            id: true,
            seq: true,
            title: true,
            description: true,
            offsetMs: true,
            type: true,
            isAnomaly: true,
          },
        },
      },
    }),
  );

  return journey
    ? {
        tenant,
        journey: normalizeJourneyNarrative(journey),
      }
    : null;
}

export async function getTenantJourneyDetail(tenantSlug: string, journeyId: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const journey = await withDbRetry(() =>
    prisma.journey.findFirst({
      where: {
        tenantId: tenant.id,
        id: journeyId,
      },
      include: {
        application: true,
        user: {
          include: {
            userTags: {
              include: { tag: true },
            },
          },
        },
        journeyTags: {
          include: { tag: true },
        },
        projectJourneys: {
          include: {
            project: true,
          },
        },
        events: {
          orderBy: { seq: "asc" },
        },
        evidences: {
          include: {
            journeyEvent: true,
          },
          orderBy: { offsetMs: "asc" },
        },
      },
    }),
  );

  if (!journey) {
    return null;
  }

  const [projects, availableJourneyTags] = await Promise.all([
    findManyWithRetry(() =>
      prisma.project.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          goal: true,
        },
      }),
    ),
    findManyWithRetry(() =>
      prisma.tag.findMany({
        where: {
          tenantId: tenant.id,
          type: TagType.JOURNEY,
          journeyTags: {
            none: { journeyId: journey.id },
          },
        },
        orderBy: { name: "asc" },
      }),
    ),
  ]);

  return {
    tenant,
    journey: normalizeJourneyNarrative(journey),
    projects,
    availableJourneyTags,
  };
}

export async function getTenantProjects(tenantSlug: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const projects = await findManyWithRetry(() =>
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      include: {
        application: true,
        _count: {
          select: { projectJourneys: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  return { tenant, projects };
}

export async function getTenantProjectDetailShell(tenantSlug: string, projectId: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const project = await withDbRetry(() =>
    prisma.project.findFirst({
      where: {
        tenantId: tenant.id,
        id: projectId,
      },
      select: {
        id: true,
        projectCode: true,
        name: true,
        goal: true,
        description: true,
        focusArea: true,
        focusTarget: true,
        focusFeature: true,
        ownerName: true,
        createdAt: true,
        updatedAt: true,
        application: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            projectJourneys: true,
          },
        },
        findings: {
          orderBy: { sortOrder: "asc" },
          take: 2,
        },
      },
    }),
  );

  return project ? { tenant, project } : null;
}

export async function getTenantProjectDetail(tenantSlug: string, projectId: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const project = await withDbRetry(() =>
    prisma.project.findFirst({
      where: {
        tenantId: tenant.id,
        id: projectId,
      },
      include: {
        application: true,
        projectJourneys: {
          include: {
            journey: {
              include: {
                user: true,
                journeyTags: {
                  include: { tag: true },
                },
              },
            },
          },
          orderBy: { addedAt: "desc" },
        },
        findings: {
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
  );

  if (!project) {
    return null;
  }

  const availableJourneys = await findManyWithRetry(() =>
    prisma.journey.findMany({
      where: {
        tenantId: tenant.id,
        projectJourneys: {
          none: { projectId: project.id },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: {
        application: true,
        user: true,
        journeyTags: {
          include: { tag: true },
        },
      },
    }),
  );

  return {
    tenant,
    project: {
      ...project,
      projectJourneys: project.projectJourneys.map((projectJourney) => ({
        ...projectJourney,
        journey: normalizeJourneyNarrative(projectJourney.journey),
      })),
    },
    criteria: {
      timeRanges: splitCriteria(project.filterTimeRangeLabel),
      pageTemplates: splitCriteria(project.filterPageTemplates),
      statuses: splitCriteria(project.filterStatuses),
      tagRules: splitCriteria(project.filterTagRules),
    },
    availableJourneys: availableJourneys.map(normalizeJourneyNarrative),
  };
}

export async function getTenantTagManagementData(tenantSlug: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const tags = await findManyWithRetry(() =>
    prisma.tag.findMany({
      where: { tenantId: tenant.id },
      include: {
        application: true,
        _count: {
          select: {
            userTags: true,
            journeyTags: true,
          },
        },
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    }),
  );

  return {
    tenant,
    userTags: tags.filter((tag) => tag.type === TagType.USER),
    journeyTags: tags.filter((tag) => tag.type === TagType.JOURNEY),
  };
}

export async function getTenantIntegrationOverview(tenantSlug: string) {
  const tenant = await getTenantOrThrow(tenantSlug);
  const last24hStart = buildStartDate("24h")!;

  const applications = await findManyWithRetry(() =>
    prisma.application.findMany({
      where: { tenantId: tenant.id },
      include: {
        integrationLogs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            users: true,
            journeys: true,
          },
        },
        users: {
          where: {
            lastActiveAt: { gte: last24hStart },
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  );

  const [journeyCount24h, activeUsers24h] = await Promise.all([
    countWithRetry(() =>
      prisma.journey.count({
        where: {
          tenantId: tenant.id,
          startedAt: { gte: last24hStart },
        },
      }),
    ),
    countWithRetry(() =>
      prisma.user.count({
        where: {
          tenantId: tenant.id,
          lastActiveAt: { gte: last24hStart },
        },
      }),
    ),
  ]);

  return {
    tenant,
    applications: applications.map((application) => ({
      ...application,
      activeUserCount24h: application.users.length,
    })),
    journeyCount24h,
    activeUsers24h,
  };
}

export async function resolveTenantSlugByJourneyId(journeyId: string) {
  const journey = await withDbRetry(() =>
    prisma.journey.findUnique({
      where: { id: journeyId },
      select: {
        tenant: {
          select: { slug: true },
        },
      },
    }),
  );

  return journey?.tenant.slug ?? null;
}

export async function resolveTenantSlugByProjectId(projectId: string) {
  const project = await withDbRetry(() =>
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        tenant: {
          select: { slug: true },
        },
      },
    }),
  );

  return project?.tenant.slug ?? null;
}

export async function resolveTenantSlugByUserId(userId: string) {
  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        tenant: {
          select: { slug: true },
        },
      },
    }),
  );

  return user?.tenant.slug ?? null;
}

export const journeyStatusLabelMap: Record<JourneyResultStatus, string> = {
  COMPLETED: "已完成",
  ABANDONED: "未完成",
  FAILED: "异常",
  BROWSING: "仅浏览退出",
};

export const applicationStatusLabelMap: Record<ApplicationStatus, string> = {
  CONNECTED: "已连接",
  DEGRADED: "部分降级",
  PENDING: "待接入",
};

export const tagTypeLabelMap: Record<TagType, string> = {
  USER: "用户标签",
  JOURNEY: "旅程标签",
};

export const tagSourceLabelMap: Record<TagSource, string> = {
  SYSTEM: "系统生成",
  MANUAL: "人工创建",
  RULE: "规则生成",
};

export const tenantPlanLabelMap: Record<TenantPlan, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  ENTERPRISE: "Enterprise",
};

export const tenantStatusLabelMap: Record<TenantStatus, string> = {
  ACTIVE: "正常运行",
  TRIAL: "试用中",
  RISK: "重点关注",
};
