import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const flowId = searchParams.get("flowId");

  const flows = flowId
    ? await prisma.chatbotFlow.findMany({ where: { id: flowId } })
    : await prisma.chatbotFlow.findMany();

  const metrics = await Promise.all(
    flows.map(async (flow) => {
      const sessionsCount = await prisma.chatbotSession.count({
        where: { flowId: flow.id },
      });
      const pathEvents = await prisma.chatbotPathEvent.groupBy({
        by: ["stepId", "eventType"],
        where: { session: { flowId: flow.id } },
        _count: true,
      });
      return {
        flowId: flow.id,
        name: flow.name,
        sessionsCount,
        pathEvents,
      };
    })
  );

  return NextResponse.json({ data: metrics });
}
