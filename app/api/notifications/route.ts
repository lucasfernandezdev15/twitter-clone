import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const actorSelect = {
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const tweetSelect = {
  id: true,
  content: true,
} as const;

export async function GET(request: Request) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: {
        select: actorSelect,
      },
      tweet: {
        select: tweetSelect,
      },
    },
  });

  return NextResponse.json({ notifications });
}
