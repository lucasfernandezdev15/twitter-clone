import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { hashPassword, signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, username, displayName, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
      },
    });

    const token = signToken(user.id);

    return NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target as string[] | undefined;

      if (target?.includes("email")) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 }
        );
      }

      if (target?.includes("username")) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    throw error;
  }
}
