import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string; journeyId: string } },
) {
  const existing = await prisma.projectJourney.findUnique({
    where: {
      projectId_journeyId: {
        projectId: params.projectId,
        journeyId: params.journeyId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "项目中不存在该旅程。" }, { status: 404 });
  }

  await prisma.projectJourney.delete({
    where: {
      projectId_journeyId: {
        projectId: params.projectId,
        journeyId: params.journeyId,
      },
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${params.projectId}`);
  revalidatePath("/journeys");
  revalidatePath(`/journeys/${params.journeyId}`);

  return NextResponse.json({ ok: true });
}
