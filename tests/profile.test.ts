import { GET as profileGET } from "@/app/api/users/[username]/route";
import { GET as userTweetsGET } from "@/app/api/users/[username]/tweets/route";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createTestServer, wrapRouteWithUsername } from "./helpers/testServer";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
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
  user: {
    findUnique: jest.Mock;
  };
  follow: {
    findUnique: jest.Mock;
  };
  tweet: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  like: {
    findMany: jest.Mock;
  };
};

const bobProfile = {
  id: "user-2",
  username: "bob",
  displayName: "Bob",
  bio: "Hello world",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  _count: {
    tweets: 5,
    followers: 10,
    following: 3,
  },
};

const mockTweetOne = {
  id: "tweet-1",
  content: "First tweet",
  authorId: bobProfile.id,
  parentId: null,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  author: {
    id: bobProfile.id,
    username: bobProfile.username,
    displayName: bobProfile.displayName,
    avatarUrl: bobProfile.avatarUrl,
  },
  _count: { likes: 2 },
};

const mockTweetTwo = {
  id: "tweet-2",
  content: "Second tweet",
  authorId: bobProfile.id,
  parentId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  author: {
    id: bobProfile.id,
    username: bobProfile.username,
    displayName: bobProfile.displayName,
    avatarUrl: bobProfile.avatarUrl,
  },
  _count: { likes: 0 },
};

describe("Profile API", () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signToken("user-1");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/users/[username]", () => {
    const { server, request } = createTestServer(
      wrapRouteWithUsername(profileGET)
    );

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns the profile when the user exists", async () => {
      prismaMock.user.findUnique.mockResolvedValue(bobProfile);

      const response = await request.get("/api/users/bob");

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        ...bobProfile,
        isFollowing: false,
        createdAt: bobProfile.createdAt.toISOString(),
      });
      expect(prismaMock.follow.findUnique).not.toHaveBeenCalled();
    });

    it("returns 404 when the user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request.get("/api/users/missing");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("returns isFollowing false without a session", async () => {
      prismaMock.user.findUnique.mockResolvedValue(bobProfile);

      const response = await request.get("/api/users/bob");

      expect(response.status).toBe(200);
      expect(response.body.user.isFollowing).toBe(false);
      expect(prismaMock.follow.findUnique).not.toHaveBeenCalled();
    });

    it("returns isFollowing false when viewing own profile", async () => {
      const ownProfile = {
        ...bobProfile,
        id: "user-1",
        username: "alice",
      };
      prismaMock.user.findUnique.mockResolvedValue(ownProfile);

      const response = await request
        .get("/api/users/alice")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.isFollowing).toBe(false);
      expect(prismaMock.follow.findUnique).not.toHaveBeenCalled();
    });

    it("returns isFollowing true when the current user follows the profile", async () => {
      prismaMock.user.findUnique.mockResolvedValue(bobProfile);
      prismaMock.follow.findUnique.mockResolvedValue({
        followerId: "user-1",
        followingId: bobProfile.id,
      });

      const response = await request
        .get("/api/users/bob")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.isFollowing).toBe(true);
      expect(prismaMock.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: "user-1",
            followingId: bobProfile.id,
          },
        },
      });
    });
  });

  describe("GET /api/users/[username]/tweets", () => {
    const { server, request } = createTestServer(
      wrapRouteWithUsername(userTweetsGET)
    );

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns paginated tweets for the user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: bobProfile.id });
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
          authorId: bobProfile.id,
          parentId: null,
          createdAt: new Date("2025-12-31T00:00:00.000Z"),
          updatedAt: new Date("2025-12-31T00:00:00.000Z"),
          author: mockTweetOne.author,
          _count: { likes: 1 },
        },
      ]);
      prismaMock.like.findMany.mockResolvedValue([{ tweetId: "tweet-1" }]);

      const response = await request
        .get("/api/users/bob/tweets?cursor=tweet-1&limit=2")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tweets).toHaveLength(2);
      expect(response.body.nextCursor).toBe("tweet-2");
      expect(response.body.tweets[0]).toEqual({
        ...mockTweetOne,
        hasLiked: true,
        createdAt: mockTweetOne.createdAt.toISOString(),
        updatedAt: mockTweetOne.updatedAt.toISOString(),
      });
      expect(response.body.tweets[1].hasLiked).toBe(false);
      expect(prismaMock.tweet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            authorId: bobProfile.id,
            OR: [
              { createdAt: { lt: mockTweetOne.createdAt } },
              {
                createdAt: mockTweetOne.createdAt,
                id: { lt: "tweet-1" },
              },
            ],
          },
          take: 3,
        })
      );
    });

    it("returns 404 when user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request.get("/api/users/missing/tweets");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("uses default limit for invalid limit param", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: bobProfile.id });
      prismaMock.tweet.findMany.mockResolvedValue([mockTweetOne]);
      prismaMock.like.findMany.mockResolvedValue([]);

      await request.get("/api/users/bob/tweets?limit=abc");

      expect(prismaMock.tweet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 })
      );
    });

    it("returns hasLiked false without authentication", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: bobProfile.id });
      prismaMock.tweet.findMany.mockResolvedValue([mockTweetOne]);
      prismaMock.like.findMany.mockResolvedValue([]);

      const response = await request.get("/api/users/bob/tweets");

      expect(response.status).toBe(200);
      expect(response.body.tweets[0].hasLiked).toBe(false);
    });
  });
});
