import {
  ApplicationStatus,
  JourneyResultStatus,
  Prisma,
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
  return undefined;
}

export async function getApplicationOverview() {
  const application = await prisma.application.findFirstOrThrow({
    include: {
      integrationLogs: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });

  const last24hStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [journeyCount24h, activeUsers24h] = await Promise.all([
    prisma.journey.count({
      where: {
        applicationId: application.id,
        startedAt: { gte: last24hStart },
      },
    }),
    prisma.user.count({
      where: {
        applicationId: application.id,
        lastActiveAt: { gte: last24hStart },
      },
    }),
  ]);

  return { application, journeyCount24h, activeUsers24h };
}

export async function getUsers(searchParams: SearchParams) {
  const query = readParam(searchParams.query);
  const tag = readParam(searchParams.tag);
  const device = readParam(searchParams.device);
  const os = readParam(searchParams.os);
  const activeRange = readParam(searchParams.activeRange);

  const activeStart = buildStartDate(activeRange);
  const where: Prisma.UserWhereInput = {
    ...(query
      ? {
          OR: [
            { externalId: { contains: query } },
            { email: { contains: query } },
            { name: { contains: query } },
          ],
        }
      : {}),
    ...(device && device !== "all" ? { deviceType: device } : {}),
    ...(os && os !== "all" ? { os: { contains: os } } : {}),
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

  const [users, availableTags] = await Promise.all([
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
    prisma.tag.findMany({
      where: { type: TagType.USER },
      orderBy: { name: "asc" },
    }),
  ]);

  return { users, availableTags };
}

export async function getUserDetail(id: string) {
  return prisma.user.findUniqueOrThrow({
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
  });
}

export async function getJourneys(searchParams: SearchParams) {
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
    ...(startedAfter ? { startedAt: { gte: startedAfter } } : {}),
    ...(userId ? { user: { externalId: { contains: userId } } } : {}),
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

  const [journeys, userTags, journeyTags, projects] = await Promise.all([
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
    prisma.tag.findMany({
      where: { type: TagType.USER },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      where: { type: TagType.JOURNEY },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        goal: true,
      },
    }),
  ]);

  return { journeys, userTags, journeyTags, projects };
}

export async function getJourneyDetail(id: string) {
  const journey = await prisma.journey.findUniqueOrThrow({
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
        orderBy: { offsetMs: "asc" },
      },
    },
  });

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      goal: true,
    },
  });

  return { journey, projects };
}

export async function getProjectDetail(id: string) {
  return prisma.project.findUniqueOrThrow({
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
  });
}

export async function getProjectList() {
  return prisma.project.findMany({
    include: {
      _count: {
        select: { projectJourneys: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export const journeyStatusLabelMap: Record<JourneyResultStatus, string> = {
  COMPLETED: "已完成",
  ABANDONED: "中途放弃",
  FAILED: "系统异常",
  BROWSING: "仅浏览退出",
};

export const applicationStatusLabelMap: Record<ApplicationStatus, string> = {
  CONNECTED: "已连接",
  DEGRADED: "部分降级",
  PENDING: "待接入",
};

