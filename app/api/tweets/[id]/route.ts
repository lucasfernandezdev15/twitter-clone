import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession(request);

  const tweet = await prisma.tweet.findUnique({
    where: { id },
    include: {
      author: {
        select: authorSelect,
      },
      _count: {
        select: { likes: true },
      },
    },
  });

  if (!tweet) {
    return NextResponse.json({ error: "Tweet not found" }, { status: 404 });
  }

  let likedByCurrentUser = false;

  if (session) {
    const like = await prisma.like.findUnique({
      where: {
        userId_tweetId: {
          userId: session.userId,
          tweetId: id,
        },
      },
    });

    likedByCurrentUser = !!like;
  }

  return NextResponse.json({
    tweet: {
      ...tweet,
      likedByCurrentUser,
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const tweet = await prisma.tweet.findUnique({
    where: { id },
  });

  if (!tweet) {
    return NextResponse.json({ error: "Tweet not found" }, { status: 404 });
  }

  if (tweet.authorId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.tweet.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
