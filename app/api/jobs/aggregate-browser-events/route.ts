import { NextResponse } from "next/server";

import { aggregateBrowserEventsForTenant } from "@/lib/journey-aggregation";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const tenantSlug = typeof body?.tenantSlug === "string" ? body.tenantSlug : undefined;
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : undefined;
  const inactivityTimeoutMs =
    typeof body?.inactivityTimeoutMs === "number" && Number.isFinite(body.inactivityTimeoutMs)
      ? body.inactivityTimeoutMs
      : undefined;

  const tenant = await prisma.tenant.findFirst({
    where: {
      ...(tenantSlug ? { slug: tenantSlug } : {}),
      ...(tenantId ? { id: tenantId } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ ok: false, error: "未找到租户。" }, { status: 404 });
  }

  const result = await aggregateBrowserEventsForTenant(tenant.id, { inactivityTimeoutMs });

  return NextResponse.json({
    ok: true,
    tenant,
    ...result,
  });
}
