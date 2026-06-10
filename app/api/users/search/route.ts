import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 1) {
    return NextResponse.json(
      { error: "Query parameter q is required" },
      { status: 400 }
    );
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query } },
        { displayName: { contains: query } },
      ],
    },
    select: userSelect,
    take: 20,
  });

  return NextResponse.json({ users });
}
