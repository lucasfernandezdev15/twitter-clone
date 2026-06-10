import { GET as healthGET } from "@/app/api/health/route";
import { GET as usersGET } from "@/app/api/users/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";

import { createTestServer } from "./helpers/testServer";

describe("Misc API", () => {
  describe("GET /api/health", () => {
    const { server, request } = createTestServer(healthGET);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns ok status", async () => {
      const response = await request.get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("POST /api/auth/logout", () => {
    const { server, request } = createTestServer(logoutPOST);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns success", async () => {
      const response = await request.post("/api/auth/logout");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  describe("GET /api/users", () => {
    const { server, request } = createTestServer(usersGET);

    afterAll(async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns not implemented", async () => {
      const response = await request.get("/api/users");
      expect(response.status).toBe(501);
      expect(response.body.message).toBe("Not implemented");
    });
  });
});
