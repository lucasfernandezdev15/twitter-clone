import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

type RouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { username } = await context.params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: {
      following: {
        select: userSelect,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    users: following.map((follow) => follow.following),
  });
}
