import { GET as timelineGET } from "@/app/api/timeline/route";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createTestServer } from "./helpers/testServer";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    follow: {
      findMany: jest.fn(),
    },
    tweet: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    like: {
      findMany: jest.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  follow: {
    findMany: jest.Mock;
  };
  tweet: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  like: {
    findMany: jest.Mock;
  };
};

const mockAuthor = {
  id: "user-1",
  username: "alice",
  displayName: "Alice",
  avatarUrl: null,
};

const mockTweetOne = {
  id: "tweet-1",
  content: "First tweet",
  authorId: mockAuthor.id,
  parentId: null,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  author: mockAuthor,
  _count: { likes: 2 },
};

const mockTweetTwo = {
  id: "tweet-2",
  content: "Second tweet",
  authorId: "user-2",
  parentId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  author: {
    id: "user-2",
    username: "bob",
    displayName: "Bob",
    avatarUrl: null,
  },
  _count: { likes: 0 },
};

describe("Timeline API", () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signToken(mockAuthor.id);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/timeline", () => {
    const { server, request } = createTestServer(timelineGET);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns tweets from followed users and the current user", async () => {
      prismaMock.follow.findMany.mockResolvedValue([
        { followingId: "user-2" },
      ]);
      prismaMock.tweet.findMany.mockResolvedValue([mockTweetOne, mockTweetTwo]);
      prismaMock.like.findMany.mockResolvedValue([{ tweetId: "tweet-1" }]);

      const response = await request
        .get("/api/timeline")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tweets).toEqual([
        {
          ...mockTweetOne,
          hasLiked: true,
          createdAt: mockTweetOne.createdAt.toISOString(),
          updatedAt: mockTweetOne.updatedAt.toISOString(),
        },
        {
          ...mockTweetTwo,
          hasLiked: false,
          createdAt: mockTweetTwo.createdAt.toISOString(),
          updatedAt: mockTweetTwo.updatedAt.toISOString(),
        },
      ]);
      expect(response.body.nextCursor).toBeNull();
      expect(prismaMock.follow.findMany).toHaveBeenCalledWith({
        where: { followerId: mockAuthor.id },
        select: { followingId: true },
      });
      expect(prismaMock.tweet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            authorId: { in: [mockAuthor.id, "user-2"] },
          },
          take: 21,
        })
      );
    });

    it("supports cursor pagination", async () => {
      prismaMock.follow.findMany.mockResolvedValue([]);
      prismaMock.tweet.findUnique.mockResolvedValue({
        id: "tweet-1",
        createdAt: mockTweetOne.createdAt,
      });
      prismaMock.tweet.findMany.mockResolvedValue([
        mockTweetOne,
        mockTweetTwo,
        {
          id: "tweet-3",
          content: "Third tweet",
          authorId: mockAuthor.id,
          parentId: null,
          createdAt: new Date("2025-12-31T00:00:00.000Z"),
          updatedAt: new Date("2025-12-31T00:00:00.000Z"),
          author: mockAuthor,
          _count: { likes: 1 },
        },
      ]);
      prismaMock.like.findMany.mockResolvedValue([]);

      const response = await request
        .get("/api/timeline?cursor=tweet-1&limit=2")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tweets).toHaveLength(2);
      expect(response.body.nextCursor).toBe("tweet-2");
      expect(prismaMock.tweet.findUnique).toHaveBeenCalledWith({
        where: { id: "tweet-1" },
        select: { id: true, createdAt: true },
      });
      expect(prismaMock.tweet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
          where: {
            authorId: { in: [mockAuthor.id] },
            OR: [
              { createdAt: { lt: mockTweetOne.createdAt } },
              {
                createdAt: mockTweetOne.createdAt,
                id: { lt: "tweet-1" },
              },
            ],
          },
        })
      );
    });

    it("returns 401 without authentication", async () => {
      const response = await request.get("/api/timeline");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
      expect(prismaMock.tweet.findMany).not.toHaveBeenCalled();
    });

    it("returns an empty timeline", async () => {
      prismaMock.follow.findMany.mockResolvedValue([]);
      prismaMock.tweet.findMany.mockResolvedValue([]);
      prismaMock.like.findMany.mockResolvedValue([]);

      const response = await request
        .get("/api/timeline")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tweets).toEqual([]);
      expect(response.body.nextCursor).toBeNull();
    });

    it("returns tweets without hasLiked when there are no likes", async () => {
      prismaMock.follow.findMany.mockResolvedValue([]);
      prismaMock.tweet.findMany.mockResolvedValue([mockTweetOne]);
      prismaMock.like.findMany.mockResolvedValue([]);

      const response = await request
        .get("/api/timeline")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tweets[0].hasLiked).toBe(false);
    });

    it("uses default limit for invalid limit param", async () => {
      prismaMock.follow.findMany.mockResolvedValue([]);
      prismaMock.tweet.findMany.mockResolvedValue([]);
      prismaMock.like.findMany.mockResolvedValue([]);

      await request
        .get("/api/timeline?limit=-5")
        .set("Authorization", `Bearer ${authToken}`);

      expect(prismaMock.tweet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 })
      );
    });
  });
});
