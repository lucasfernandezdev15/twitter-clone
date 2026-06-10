import { Prisma } from "@prisma/client";

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { POST as registerPOST } from "@/app/api/auth/register/route";
import { hashPassword, signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createTestServer } from "./helpers/testServer";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  user: {
    create: jest.Mock;
    findUnique: jest.Mock;
  };
};

const mockUser = {
  id: "user-1",
  email: "alice@example.com",
  username: "alice",
  displayName: "Alice",
  passwordHash: "",
  bio: null,
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Auth API", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    mockUser.passwordHash = await hashPassword("password123");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    const { server, request } = createTestServer(registerPOST);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("registers a user successfully", async () => {
      prismaMock.user.create.mockResolvedValue(mockUser);

      const response = await request.post("/api/auth/register").send({
        email: "alice@example.com",
        username: "alice",
        displayName: "Alice",
        password: "password123",
      });

      expect(response.status).toBe(201);
      expect(response.body.token).toEqual(expect.any(String));
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        displayName: mockUser.displayName,
      });
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: "alice@example.com",
          username: "alice",
          displayName: "Alice",
          passwordHash: expect.any(String),
        },
      });
    });

    it("returns 409 when email already exists", async () => {
      prismaMock.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["email"] },
        })
      );

      const response = await request.post("/api/auth/register").send({
        email: "alice@example.com",
        username: "alice2",
        displayName: "Alice",
        password: "password123",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email already exists");
    });

    it("returns 409 when username already exists", async () => {
      prismaMock.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["username"] },
        })
      );

      const response = await request.post("/api/auth/register").send({
        email: "bob@example.com",
        username: "alice",
        displayName: "Bob",
        password: "password123",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Username already exists");
    });

    it("returns 400 when validation fails", async () => {
      const response = await request.post("/api/auth/register").send({
        email: "not-an-email",
        username: "a",
        displayName: "",
        password: "short",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual(
        expect.objectContaining({
          email: expect.any(Array),
          username: expect.any(Array),
          displayName: expect.any(Array),
          password: expect.any(Array),
        })
      );
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid JSON body", async () => {
      const response = await request
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send("{ invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid JSON body");
    });

    it("returns 409 for generic duplicate user error", async () => {
      prismaMock.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["unknown"] },
        })
      );

      const response = await request.post("/api/auth/register").send({
        email: "new@example.com",
        username: "newuser",
        displayName: "New",
        password: "password123",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("User already exists");
    });

    it("propagates unexpected database errors", async () => {
      prismaMock.user.create.mockRejectedValue(new Error("Database offline"));

      const response = await request.post("/api/auth/register").send({
        email: "new@example.com",
        username: "newuser",
        displayName: "New",
        password: "password123",
      });

      expect(response.status).toBe(500);
    });
  });

  describe("POST /api/auth/login", () => {
    const { server, request } = createTestServer(loginPOST);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("logs in successfully", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await request.post("/api/auth/login").send({
        email: "alice@example.com",
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toEqual(expect.any(String));
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        displayName: mockUser.displayName,
      });
    });

    it("returns 401 when email does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request.post("/api/auth/login").send({
        email: "missing@example.com",
        password: "password123",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("returns 401 when password is incorrect", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await request.post("/api/auth/login").send({
        email: "alice@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("returns 400 when validation fails", async () => {
      const response = await request.post("/api/auth/login").send({
        email: "not-an-email",
        password: "",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual(
        expect.objectContaining({
          email: expect.any(Array),
          password: expect.any(Array),
        })
      );
    });

    it("returns 400 for invalid JSON body", async () => {
      const response = await request
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send("{ invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid JSON body");
    });
  });

  describe("GET /api/auth/me", () => {
    const { server, request } = createTestServer(meGET);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns the current user with a valid token", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        displayName: mockUser.displayName,
        bio: mockUser.bio,
        avatarUrl: mockUser.avatarUrl,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      const token = signToken(mockUser.id);

      const response = await request
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        displayName: mockUser.displayName,
        bio: mockUser.bio,
        avatarUrl: mockUser.avatarUrl,
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it("returns 401 without a token", async () => {
      const response = await request.get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns 401 with an invalid token", async () => {
      const response = await request
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns 401 when user no longer exists", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const token = signToken("deleted-user");

      const response = await request
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });
  });
});
