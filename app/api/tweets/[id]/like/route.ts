import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tweetId } = await context.params;

  const tweet = await prisma.tweet.findUnique({
    where: { id: tweetId },
    select: { id: true, authorId: true },
  });

  if (!tweet) {
    return NextResponse.json({ error: "Tweet not found" }, { status: 404 });
  }

  const existingLike = await prisma.like.findUnique({
    where: {
      userId_tweetId: {
        userId: session.userId,
        tweetId,
      },
    },
  });

  if (existingLike) {
    await prisma.like.delete({
      where: {
        userId_tweetId: {
          userId: session.userId,
          tweetId,
        },
      },
    });

    const likesCount = await prisma.like.count({
      where: { tweetId },
    });

    return NextResponse.json({ liked: false, likesCount });
  }

  await prisma.$transaction(async (tx) => {
    await tx.like.create({
      data: {
        userId: session.userId,
        tweetId,
      },
    });

    if (tweet.authorId !== session.userId) {
      await tx.notification.create({
        data: {
          userId: tweet.authorId,
          actorId: session.userId,
          type: "LIKE",
          tweetId,
        },
      });
    }
  });

  const likesCount = await prisma.like.count({
    where: { tweetId },
  });

  return NextResponse.json({ liked: true, likesCount });
}
