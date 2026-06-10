import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function GET(request: Request) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = Number(searchParams.get("limit") ?? "20");
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 100)
      : 20;

  const follows = await prisma.follow.findMany({
    where: { followerId: session.userId },
    select: { followingId: true },
  });

  const authorIds = [
    session.userId,
    ...follows.map((follow) => follow.followingId),
  ];

  let cursorTweet: { id: string; createdAt: Date } | null = null;

  if (cursor) {
    cursorTweet = await prisma.tweet.findUnique({
      where: { id: cursor },
      select: { id: true, createdAt: true },
    });
  }

  const tweets = await prisma.tweet.findMany({
    where: {
      authorId: { in: authorIds },
      ...(cursorTweet
        ? {
            OR: [
              { createdAt: { lt: cursorTweet.createdAt } },
              {
                createdAt: cursorTweet.createdAt,
                id: { lt: cursorTweet.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      author: {
        select: authorSelect,
      },
      _count: {
        select: { likes: true },
      },
    },
  });

  const hasMore = tweets.length > limit;
  const page = hasMore ? tweets.slice(0, limit) : tweets;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  const likes = await prisma.like.findMany({
    where: {
      userId: session.userId,
      tweetId: { in: page.map((tweet) => tweet.id) },
    },
    select: { tweetId: true },
  });

  const likedTweetIds = new Set(likes.map((like) => like.tweetId));

  return NextResponse.json({
    tweets: page.map((tweet) => ({
      ...tweet,
      hasLiked: likedTweetIds.has(tweet.id),
    })),
    nextCursor,
  });
}
