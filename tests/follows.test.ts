import { POST as followPOST } from "@/app/api/users/[username]/follow/route";
import { GET as followersGET } from "@/app/api/users/[username]/followers/route";
import { GET as followingGET } from "@/app/api/users/[username]/following/route";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createTestServer, wrapRouteWithUsername } from "./helpers/testServer";

jest.mock("@/lib/prisma", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma)
  );

  return { prisma };
});

const prismaMock = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
  };
  follow: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
  };
  notification: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

const alice = {
  id: "user-1",
  username: "alice",
  displayName: "Alice",
  avatarUrl: null,
};

const bob = {
  id: "user-2",
  username: "bob",
  displayName: "Bob",
  avatarUrl: null,
};

describe("Follows API", () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signToken(alice.id);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) =>
        callback(prismaMock)
    );
  });

  describe("POST /api/users/[username]/follow", () => {
    const { server, request } = createTestServer(
      wrapRouteWithUsername(followPOST)
    );

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("follows a user and creates a notification", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: bob.id });
      prismaMock.follow.findUnique.mockResolvedValue(null);
      prismaMock.follow.create.mockResolvedValue({
        followerId: alice.id,
        followingId: bob.id,
      });
      prismaMock.notification.create.mockResolvedValue({ id: "notification-1" });

      const response = await request
        .post("/api/users/bob/follow")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.following).toBe(true);
      expect(prismaMock.follow.create).toHaveBeenCalledWith({
        data: {
          followerId: alice.id,
          followingId: bob.id,
        },
      });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          userId: bob.id,
          actorId: alice.id,
          type: "FOLLOW",
        },
      });
    });

    it("unfollows a user when already following", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: bob.id });
      prismaMock.follow.findUnique.mockResolvedValue({
        followerId: alice.id,
        followingId: bob.id,
      });
      prismaMock.follow.delete.mockResolvedValue({
        followerId: alice.id,
        followingId: bob.id,
      });

      const response = await request
        .post("/api/users/bob/follow")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.following).toBe(false);
      expect(prismaMock.follow.delete).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: alice.id,
            followingId: bob.id,
          },
        },
      });
      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });

    it("returns 400 when trying to follow yourself", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: alice.id });

      const response = await request
        .post("/api/users/alice/follow")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("You cannot follow yourself");
      expect(prismaMock.follow.create).not.toHaveBeenCalled();
    });

    it("returns 401 without authentication", async () => {
      const response = await request.post("/api/users/bob/follow");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("returns 404 when user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request
        .post("/api/users/missing/follow")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });
  });

  describe("GET /api/users/[username]/followers", () => {
    const { server, request } = createTestServer(
      wrapRouteWithUsername(followersGET)
    );

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns the followers list", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: bob.id });
      prismaMock.follow.findMany.mockResolvedValue([
        {
          follower: alice,
        },
      ]);

      const response = await request.get("/api/users/bob/followers");

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([alice]);
      expect(prismaMock.follow.findMany).toHaveBeenCalledWith({
        where: { followingId: bob.id },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns 404 when user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request.get("/api/users/missing/followers");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });
  });

  describe("GET /api/users/[username]/following", () => {
    const { server, request } = createTestServer(
      wrapRouteWithUsername(followingGET)
    );

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns the following list", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: alice.id });
      prismaMock.follow.findMany.mockResolvedValue([
        {
          following: bob,
        },
      ]);

      const response = await request.get("/api/users/alice/following");

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([bob]);
      expect(prismaMock.follow.findMany).toHaveBeenCalledWith({
        where: { followerId: alice.id },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns 404 when user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request.get("/api/users/missing/following");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });
  });
});
