import { signToken } from "@/lib/auth";
import { getSession } from "@/lib/session";

describe("lib/session", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns session from Authorization bearer token", async () => {
    const token = signToken("user-1");
    const request = new Request("http://localhost/api/test", {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(getSession(request)).resolves.toEqual({ userId: "user-1" });
  });

  it("returns session from token cookie", async () => {
    const token = signToken("user-2");
    const request = new Request("http://localhost/api/test", {
      headers: { cookie: `token=${encodeURIComponent(token)}` },
    });

    await expect(getSession(request)).resolves.toEqual({ userId: "user-2" });
  });

  it("returns null without a token", async () => {
    const request = new Request("http://localhost/api/test");
    await expect(getSession(request)).resolves.toBeNull();
  });

  it("returns null for an invalid token", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: { Authorization: "Bearer invalid" },
    });

    await expect(getSession(request)).resolves.toBeNull();
  });

  it("returns null when cookie token is empty", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: { cookie: "token=" },
    });

    await expect(getSession(request)).resolves.toBeNull();
  });
});
