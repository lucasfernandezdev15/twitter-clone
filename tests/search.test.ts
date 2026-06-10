import { GET as searchGET } from "@/app/api/users/search/route";
import { prisma } from "@/lib/prisma";

import { createTestServer } from "./helpers/testServer";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  user: {
    findMany: jest.Mock;
  };
};

const alice = {
  id: "user-1",
  username: "alice",
  displayName: "Alice Wonder",
  avatarUrl: null,
};

const bob = {
  id: "user-2",
  username: "bobby",
  displayName: "Bob",
  avatarUrl: "https://example.com/bob.png",
};

describe("Search API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/users/search", () => {
    const { server, request } = createTestServer(searchGET);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("trims the search query before searching", async () => {
      prismaMock.user.findMany.mockResolvedValue([alice]);

      const response = await request.get("/api/users/search?q=%20ali%20");

      expect(response.status).toBe(200);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { username: { contains: "ali" } },
              { displayName: { contains: "ali" } },
            ],
          },
        })
      );
    });

    it("finds users by username", async () => {
      prismaMock.user.findMany.mockResolvedValue([alice]);

      const response = await request.get("/api/users/search?q=ali");

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([alice]);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { contains: "ali" } },
            { displayName: { contains: "ali" } },
          ],
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
        take: 20,
      });
    });

    it("finds users by displayName", async () => {
      prismaMock.user.findMany.mockResolvedValue([alice]);

      const response = await request.get("/api/users/search?q=wonder");

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([alice]);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { username: { contains: "wonder" } },
              { displayName: { contains: "wonder" } },
            ],
          },
        })
      );
    });

    it("returns an empty list when there is no match", async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      const response = await request.get("/api/users/search?q=zzz");

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([]);
    });

    it("returns 400 when query param is missing", async () => {
      const response = await request.get("/api/users/search");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Query parameter q is required");
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 when query is empty", async () => {
      const response = await request.get("/api/users/search?q=");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Query parameter q is required");
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 when query is only whitespace", async () => {
      const response = await request.get("/api/users/search?q=%20%20");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Query parameter q is required");
    });
  });
});
