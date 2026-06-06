import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { tenantId: string } },
) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantId },
    select: {
      slug: true,
      status: true,
      plan: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "租户不存在。" }, { status: 404 });
  }

  return NextResponse.json({ tenant });
}
