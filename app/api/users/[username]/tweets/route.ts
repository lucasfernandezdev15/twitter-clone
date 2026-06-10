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
  params: Promise<{ username: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { username } = await context.params;
  const session = await getSession(request);

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = Number(searchParams.get("limit") ?? "20");
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 100)
      : 20;

  let cursorTweet: { id: string; createdAt: Date } | null = null;

  if (cursor) {
    cursorTweet = await prisma.tweet.findUnique({
      where: { id: cursor },
      select: { id: true, createdAt: true },
    });
  }

  const tweets = await prisma.tweet.findMany({
    where: {
      authorId: user.id,
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

  let likedTweetIds = new Set<string>();

  if (session) {
    const likes = await prisma.like.findMany({
      where: {
        userId: session.userId,
        tweetId: { in: page.map((tweet) => tweet.id) },
      },
      select: { tweetId: true },
    });

    likedTweetIds = new Set(likes.map((like) => like.tweetId));
  }

  return NextResponse.json({
    tweets: page.map((tweet) => ({
      ...tweet,
      hasLiked: likedTweetIds.has(tweet.id),
    })),
    nextCursor,
  });
}
