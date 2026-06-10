import {
  comparePassword,
  hashPassword,
  signToken,
  verifyToken,
} from "@/lib/auth";

describe("lib/auth", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("signs and verifies a token", () => {
    const token = signToken("user-1");
    expect(verifyToken(token)).toEqual({ userId: "user-1" });
  });

  it("returns null for an invalid token", () => {
    expect(verifyToken("invalid-token")).toBeNull();
  });

  it("returns null when payload has no userId", () => {
    const jwt = require("jsonwebtoken");
    const token = jwt.sign({ foo: "bar" }, "test-secret");
    expect(verifyToken(token)).toBeNull();
  });

  it("hashes and compares passwords", async () => {
    const hash = await hashPassword("password123");
    expect(await comparePassword("password123", hash)).toBe(true);
    expect(await comparePassword("wrong", hash)).toBe(false);
  });

  it("throws when JWT_SECRET is missing", () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => signToken("user-1")).toThrow("JWT_SECRET is not set");
    process.env.JWT_SECRET = original;
  });
});
