import { POST as likePOST } from "@/app/api/tweets/[id]/like/route";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createTestServer, wrapRouteWithTweetId } from "./helpers/testServer";

jest.mock("@/lib/prisma", () => {
  const prisma = {
    tweet: {
      findUnique: jest.fn(),
    },
    like: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
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
  tweet: {
    findUnique: jest.Mock;
  };
  like: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  notification: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

const alice = { id: "user-1" };
const bob = { id: "user-2" };

describe("Likes API", () => {
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

  describe("POST /api/tweets/[id]/like", () => {
    const { server, request } = createTestServer(
      wrapRouteWithTweetId(likePOST)
    );

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("likes a tweet and creates a notification", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue({
        id: "tweet-1",
        authorId: bob.id,
      });
      prismaMock.like.findUnique.mockResolvedValue(null);
      prismaMock.like.create.mockResolvedValue({
        userId: alice.id,
        tweetId: "tweet-1",
      });
      prismaMock.notification.create.mockResolvedValue({ id: "notification-1" });
      prismaMock.like.count.mockResolvedValue(1);

      const response = await request
        .post("/api/tweets/tweet-1/like")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ liked: true, likesCount: 1 });
      expect(prismaMock.like.create).toHaveBeenCalledWith({
        data: {
          userId: alice.id,
          tweetId: "tweet-1",
        },
      });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          userId: bob.id,
          actorId: alice.id,
          type: "LIKE",
          tweetId: "tweet-1",
        },
      });
    });

    it("unlikes a tweet when already liked", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue({
        id: "tweet-1",
        authorId: bob.id,
      });
      prismaMock.like.findUnique.mockResolvedValue({
        userId: alice.id,
        tweetId: "tweet-1",
      });
      prismaMock.like.delete.mockResolvedValue({
        userId: alice.id,
        tweetId: "tweet-1",
      });
      prismaMock.like.count.mockResolvedValue(0);

      const response = await request
        .post("/api/tweets/tweet-1/like")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ liked: false, likesCount: 0 });
      expect(prismaMock.like.delete).toHaveBeenCalledWith({
        where: {
          userId_tweetId: {
            userId: alice.id,
            tweetId: "tweet-1",
          },
        },
      });
      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });

    it("does not notify when liking your own tweet", async () => {
      prismaMock.tweet.findUnique.mockResolvedValue({
        id: "tweet-1",
        authorId: alice.id,
      });
      prismaMock.like.findUnique.mockResolvedValue(null);
      prismaMock.like.create.mockResolvedValue({
        userId: alice.id,
        tweetId: "tweet-1",
      });
      prismaMock.like.count.mockResolvedValue(1);

      const response = await request
        .post("/api/tweets/tweet-1/like")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ liked: true, likesCount: 1 });
      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });
  });
});
