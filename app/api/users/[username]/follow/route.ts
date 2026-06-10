import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type RouteContext = {
  params: Promise<{ username: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await context.params;

  const targetUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.id === session.userId) {
    return NextResponse.json(
      { error: "You cannot follow yourself" },
      { status: 400 }
    );
  }

  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.userId,
        followingId: targetUser.id,
      },
    },
  });

  if (existingFollow) {
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: targetUser.id,
        },
      },
    });

    return NextResponse.json({ following: false });
  }

  await prisma.$transaction(async (tx) => {
    await tx.follow.create({
      data: {
        followerId: session.userId,
        followingId: targetUser.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: targetUser.id,
        actorId: session.userId,
        type: "FOLLOW",
      },
    });
  });

  return NextResponse.json({ following: true });
}
