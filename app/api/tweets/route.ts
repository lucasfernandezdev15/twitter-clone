import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { tweetSchema } from "@/lib/validators";

const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function POST(request: Request) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = tweetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { content, parentId } = parsed.data;

  if (parentId) {
    const parent = await prisma.tweet.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      return NextResponse.json(
        { error: "Parent tweet not found" },
        { status: 404 }
      );
    }
  }

  const tweet = await prisma.$transaction(async (tx) => {
    const created = await tx.tweet.create({
      data: {
        content,
        authorId: session.userId,
        parentId,
      },
      include: {
        author: {
          select: authorSelect,
        },
      },
    });

    if (parentId) {
      const parent = await tx.tweet.findUnique({
        where: { id: parentId },
      });

      if (parent && parent.authorId !== session.userId) {
        await tx.notification.create({
          data: {
            userId: parent.authorId,
            actorId: session.userId,
            type: "REPLY",
            tweetId: created.id,
          },
        });
      }
    }

    return created;
  });

  return NextResponse.json({ tweet }, { status: 201 });
}
