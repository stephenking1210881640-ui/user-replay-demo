import {
  ApplicationStatus,
  JourneyResultStatus,
  Prisma,
  TagSource,
  TagType,
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

async function getApplicationOrThrow() {
  return withDbRetry(() =>
    prisma.application.findFirstOrThrow({
      orderBy: { createdAt: "asc" },
    }),
  );
}

async function findManyWithRetry<T>(task: () => Promise<T>) {
  return withDbRetry(task);
}

async function countWithRetry(task: () => Promise<number>) {
  return withDbRetry(task);
}

export async function getApplicationOverview() {
  const application = await withDbRetry(() =>
    prisma.application.findFirstOrThrow({
      include: {
        integrationLogs: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    }),
  );

  const last24hStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const journeyCount24h = await countWithRetry(() =>
    prisma.journey.count({
      where: {
        applicationId: application.id,
        startedAt: { gte: last24hStart },
      },
    }),
  );
  const activeUsers24h = await countWithRetry(() =>
    prisma.user.count({
      where: {
        applicationId: application.id,
        lastActiveAt: { gte: last24hStart },
      },
    }),
  );

  return { application, journeyCount24h, activeUsers24h };
}

export async function getOverviewData() {
  const application = await getApplicationOrThrow();
  const last7dStart = buildStartDate("7d")!;

  const journeys = await findManyWithRetry(() =>
    prisma.journey.findMany({
      where: {
        applicationId: application.id,
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
  );
  const recentProjects = await findManyWithRetry(() =>
    prisma.project.findMany({
      where: { applicationId: application.id },
      include: {
        _count: {
          select: { projectJourneys: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  );
  const recentActiveUsers = await findManyWithRetry(() =>
    prisma.user.findMany({
      where: {
        applicationId: application.id,
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
  );

  const successCount = journeys.filter((journey) => journey.resultStatus === "COMPLETED").length;
  const anomalyCount = journeys.filter((journey) => journey.hasAnomaly).length;
  const unfinishedCount = journeys.filter(
    (journey) => journey.resultStatus === "ABANDONED" || journey.resultStatus === "BROWSING",
  ).length;
  const abnormalJourneys = journeys
    .filter((journey) => journey.hasAnomaly || journey.resultStatus !== "COMPLETED")
    .slice(0, 4);

  const checkoutProblemJourneys = journeys.filter(
    (journey) =>
      journey.pageTemplate === "/checkout" &&
      (journey.hasAnomaly || journey.resultStatus === "ABANDONED"),
  ).length;
  const longestJourney = [...journeys].sort((a, b) => b.totalDurationMs - a.totalDurationMs)[0];

  const insight =
    checkoutProblemJourneys > 0
      ? `最近 7 天共有 ${checkoutProblemJourneys} 条结算链路样本出现异常或中途放弃，优先查看“新版结算页可用性验证”项目。`
      : longestJourney
        ? `最近 7 天最长旅程为 ${longestJourney.journeyCode}，建议从长停留节点反查理解成本。`
        : "最近 7 天暂无足够旅程样本，建议先回看接入状态与采集完整性。";

  return {
    metrics: {
      last7dJourneyCount: journeys.length,
      successCount,
      anomalyCount,
      unfinishedCount,
      successRate: journeys.length ? Math.round((successCount / journeys.length) * 100) : 0,
    },
    recentAnomalyJourneys: abnormalJourneys,
    recentProjects,
    recentActiveUsers,
    insight,
  };
}

export async function getUsers(searchParams: SearchParams) {
  const application = await getApplicationOrThrow();
  const query = readParam(searchParams.query);
  const tag = readParam(searchParams.tag);
  const device = readParam(searchParams.device);
  const os = readParam(searchParams.os);
  const activeRange = readParam(searchParams.activeRange);

  const activeStart = buildStartDate(activeRange);
  const where: Prisma.UserWhereInput = {
    applicationId: application.id,
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
      where: { applicationId: application.id, type: TagType.USER },
      orderBy: { name: "asc" },
    }),
  );

  return { users, availableTags };
}

export async function getUserDetail(id: string) {
  const user = await withDbRetry(() =>
    prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
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

  const availableTags = await findManyWithRetry(() =>
    prisma.tag.findMany({
      where: {
        applicationId: user.applicationId,
        type: TagType.USER,
        userTags: {
          none: { userId: user.id },
        },
      },
      orderBy: { name: "asc" },
    }),
  );

  return { user, availableTags };
}

export async function getJourneys(searchParams: SearchParams) {
  const application = await getApplicationOrThrow();
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
    applicationId: application.id,
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

  const journeys = await findManyWithRetry(() =>
    prisma.journey.findMany({
      where,
      include: {
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
  );
  const userTags = await findManyWithRetry(() =>
    prisma.tag.findMany({
      where: { applicationId: application.id, type: TagType.USER },
      orderBy: { name: "asc" },
    }),
  );
  const journeyTags = await findManyWithRetry(() =>
    prisma.tag.findMany({
      where: { applicationId: application.id, type: TagType.JOURNEY },
      orderBy: { name: "asc" },
    }),
  );
  const projects = await findManyWithRetry(() =>
    prisma.project.findMany({
      where: { applicationId: application.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        goal: true,
      },
    }),
  );

  return { journeys, userTags, journeyTags, projects };
}

export async function getJourneyDetail(id: string) {
  const journey = await withDbRetry(() =>
    prisma.journey.findUniqueOrThrow({
      where: { id },
      include: {
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

  const projects = await findManyWithRetry(() =>
    prisma.project.findMany({
      where: { applicationId: journey.applicationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        goal: true,
      },
    }),
  );
  const availableJourneyTags = await findManyWithRetry(() =>
    prisma.tag.findMany({
      where: {
        applicationId: journey.applicationId,
        type: TagType.JOURNEY,
        journeyTags: {
          none: { journeyId: journey.id },
        },
      },
      orderBy: { name: "asc" },
    }),
  );

  const failedRequests = journey.events.filter(
    (event) => event.type === "REQUEST" && event.statusCode && event.statusCode >= 400,
  );
  const longRequests = journey.events.filter(
    (event) => event.type === "REQUEST" && (event.durationMs ?? 0) >= 1800,
  );
  const feedbackEvidence = journey.evidences.filter(
    (evidence) => evidence.type === "TOAST" || evidence.type === "SCREENSHOT" || evidence.type === "DOM_SNAPSHOT",
  );

  return {
    journey,
    projects,
    availableJourneyTags,
    evidenceGroups: {
      failedRequests,
      longRequests,
      feedbackEvidence,
    },
  };
}

export async function getProjectDetail(id: string) {
  const project = await withDbRetry(() =>
    prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
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

  const availableJourneys = await findManyWithRetry(() =>
    prisma.journey.findMany({
      where: {
        applicationId: project.applicationId,
        projectJourneys: {
          none: { projectId: project.id },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: {
        user: true,
        journeyTags: {
          include: { tag: true },
        },
      },
    }),
  );

  return {
    project,
    criteria: {
      timeRanges: splitCriteria(project.filterTimeRangeLabel),
      pageTemplates: splitCriteria(project.filterPageTemplates),
      statuses: splitCriteria(project.filterStatuses),
      tagRules: splitCriteria(project.filterTagRules),
    },
    availableJourneys,
  };
}

export async function getProjectList() {
  const application = await getApplicationOrThrow();
  return findManyWithRetry(() =>
    prisma.project.findMany({
      where: {
        applicationId: application.id,
      },
      include: {
        _count: {
          select: { projectJourneys: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function getTagManagementData() {
  const application = await getApplicationOrThrow();
  const tags = await findManyWithRetry(() =>
    prisma.tag.findMany({
      where: { applicationId: application.id },
      include: {
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
    userTags: tags.filter((tag) => tag.type === TagType.USER),
    journeyTags: tags.filter((tag) => tag.type === TagType.JOURNEY),
  };
}

export const journeyStatusLabelMap: Record<JourneyResultStatus, string> = {
  COMPLETED: "已完成",
  ABANDONED: "中途放弃",
  FAILED: "异常失败",
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
