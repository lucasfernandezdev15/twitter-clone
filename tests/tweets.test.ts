import { DELETE as deleteTweetDELETE } from "@/app/api/tweets/[id]/route";
import { GET as getTweetGET } from "@/app/api/tweets/[id]/route";
import { POST as createTweetPOST } from "@/app/api/tweets/route";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createTestServer, wrapRouteWithParams } from "./helpers/testServer";

jest.mock("@/lib/prisma", () => {
  const prisma = {
    tweet: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    like: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma)
  );

  return { prisma };
});

const prismaMock = prisma as unknown as {
  tweet: {
    create: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
  };
  notification: {
    create: jest.Mock;
  };
  like: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockAuthor = {
  id: "user-1",
  username: "alice",
  displayName: "Alice",
  avatarUrl: null,
};

const mockTweet = {
  id: "tweet-1",
  content: "Hello Twitterly",
  authorId: mockAuthor.id,
  parentId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  author: mockAuthor,
};

describe("Tweets API", () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signToken(mockAuthor.id);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)
    );
  });

  describe("POST /api/tweets", () => {
    const { server, request } = createTestServer(createTweetPOST);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("creates a tweet successfully", async () => {
      prismaMock.tweet.create.mockResolvedValue(mockTweet);

      const response = await request
        .post("/api/tweets")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "Hello Twitterly" });

      expect(response.status).toBe(201);
      expect(response.body.tweet).toEqual({
        ...mockTweet,
        createdAt: mockTweet.createdAt.toISOString(),
        updatedAt: mockTweet.updatedAt.toISOString(),
      });
      expect(prismaMock.tweet.create).toHaveBeenCalledWith({
        data: {
          content: "Hello Twitterly",
          authorId: mockAuthor.id,
          parentId: undefined,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });
    });

    it("returns 401 without authentication", async () => {
      const response = await request
        .post("/api/tweets")
        .send({ content: "Hello Twitterly" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
      expect(prismaMock.tweet.create).not.toHaveBeenCalled();
    });

    it("returns 400 when content is empty", async () => {
      const response = await request
        .post("/api/tweets")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "   " });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual(
        expect.objectContaining({
          content: expect.any(Array),
        })
      );
      expect(prismaMock.tweet.create).not.toHaveBeenCalled();
    });

    it("returns 400 when content exceeds 280 characters", async () => {
      const response = await request
        .post("/api/tweets")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "a".repeat(281) });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual(
        expect.objectContaining({
          content: expect.any(Array),
        })
      );
      expect(prismaMock.tweet.create).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid JSON body", async () => {
      const response = await request
        .post("/api/tweets")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send("{ invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid JSON body");
    });

    it("returns 404 when parent tweet does not exist", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue(null);

      const response = await request
        .post("/api/tweets")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "A reply", parentId: "missing-parent" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Parent tweet not found");
    });

    it("does not notify when replying to your own tweet", async () => {
      const parentTweet = {
        id: "parent-1",
        authorId: mockAuthor.id,
        content: "My tweet",
      };
      const replyTweet = {
        ...mockTweet,
        id: "tweet-reply",
        content: "Self reply",
        parentId: "parent-1",
      };

      prismaMock.tweet.findUnique
        .mockResolvedValueOnce(parentTweet)
        .mockResolvedValueOnce(parentTweet);
      prismaMock.tweet.create.mockResolvedValue(replyTweet);

      const response = await request
        .post("/api/tweets")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "Self reply", parentId: "parent-1" });

      expect(response.status).toBe(201);
      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });

    it("creates a reply and notifies the parent author", async () => {
      const parentTweet = {
        id: "parent-1",
        authorId: "user-2",
        content: "Parent",
      };
      const replyTweet = {
        ...mockTweet,
        id: "tweet-reply",
        content: "A reply",
        parentId: "parent-1",
      };

      prismaMock.tweet.findUnique
        .mockResolvedValueOnce(parentTweet)
        .mockResolvedValueOnce(parentTweet);
      prismaMock.tweet.create.mockResolvedValue(replyTweet);

      const response = await request
        .post("/api/tweets")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "A reply", parentId: "parent-1" });

      expect(response.status).toBe(201);
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-2",
          actorId: mockAuthor.id,
          type: "REPLY",
          tweetId: "tweet-reply",
        },
      });
    });
  });

  describe("DELETE /api/tweets/[id]", () => {
    const { server, request } = createTestServer(
      wrapRouteWithParams(deleteTweetDELETE, "id")
    );

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("deletes a tweet successfully", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue(mockTweet);
      prismaMock.tweet.delete.mockResolvedValue(mockTweet);

      const response = await request
        .delete("/api/tweets/tweet-1")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prismaMock.tweet.delete).toHaveBeenCalledWith({
        where: { id: "tweet-1" },
      });
    });

    it("returns 401 without authentication", async () => {
      const response = await request.delete("/api/tweets/tweet-1");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
      expect(prismaMock.tweet.delete).not.toHaveBeenCalled();
    });

    it("returns 403 when deleting another user's tweet", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue({
        ...mockTweet,
        authorId: "user-2",
      });

      const response = await request
        .delete("/api/tweets/tweet-1")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Forbidden");
      expect(prismaMock.tweet.delete).not.toHaveBeenCalled();
    });

    it("returns 404 when tweet does not exist", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue(null);

      const response = await request
        .delete("/api/tweets/missing-tweet")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Tweet not found");
      expect(prismaMock.tweet.delete).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/tweets/[id]", () => {
    const { server, request } = createTestServer(
      wrapRouteWithParams(getTweetGET, "id")
    );

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns a tweet successfully", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue({
        ...mockTweet,
        _count: { likes: 3 },
      });
      prismaMock.like.findUnique.mockResolvedValue({ userId: mockAuthor.id });

      const response = await request
        .get("/api/tweets/tweet-1")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tweet).toEqual({
        ...mockTweet,
        _count: { likes: 3 },
        likedByCurrentUser: true,
        createdAt: mockTweet.createdAt.toISOString(),
        updatedAt: mockTweet.updatedAt.toISOString(),
      });
    });

    it("returns 404 when tweet does not exist", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue(null);

      const response = await request.get("/api/tweets/missing-tweet");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Tweet not found");
    });

    it("returns likedByCurrentUser false without authentication", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue({
        ...mockTweet,
        _count: { likes: 1 },
      });

      const response = await request.get("/api/tweets/tweet-1");

      expect(response.status).toBe(200);
      expect(response.body.tweet.likedByCurrentUser).toBe(false);
      expect(prismaMock.like.findUnique).not.toHaveBeenCalled();
    });
  });
});
