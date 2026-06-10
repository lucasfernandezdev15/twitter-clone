import { GET as notificationsGET } from "@/app/api/notifications/route";
import { POST as readNotificationsPOST } from "@/app/api/notifications/read/route";
import { GET as unreadCountGET } from "@/app/api/notifications/unread-count/route";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createTestServer } from "./helpers/testServer";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  notification: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
};

const alice = { id: "user-1" };

const mockNotification = {
  id: "notification-1",
  userId: alice.id,
  actorId: "user-2",
  type: "LIKE",
  tweetId: "tweet-1",
  read: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  actor: {
    username: "bob",
    displayName: "Bob",
    avatarUrl: null,
  },
  tweet: {
    id: "tweet-1",
    content: "Hello",
  },
};

describe("Notifications API", () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signToken(alice.id);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/notifications", () => {
    const { server, request } = createTestServer(notificationsGET);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns the notifications list", async () => {
      prismaMock.notification.findMany.mockResolvedValue([mockNotification]);

      const response = await request
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications).toEqual([
        {
          ...mockNotification,
          createdAt: mockNotification.createdAt.toISOString(),
        },
      ]);
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: { userId: alice.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          actor: {
            select: {
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          tweet: {
            select: {
              id: true,
              content: true,
            },
          },
        },
      });
    });
  });

  describe("POST /api/notifications/read", () => {
    const { server, request } = createTestServer(readNotificationsPOST);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("marks all notifications as read", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({ count: 2 });

      const response = await request
        .post("/api/notifications/read")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: alice.id, read: false },
        data: { read: true },
      });
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    const { server, request } = createTestServer(unreadCountGET);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns the unread notifications count", async () => {
      prismaMock.notification.count.mockResolvedValue(3);

      const response = await request
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(3);
      expect(prismaMock.notification.count).toHaveBeenCalledWith({
        where: { userId: alice.id, read: false },
      });
    });
  });
});
