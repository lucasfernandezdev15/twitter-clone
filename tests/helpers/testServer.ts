import http from "http";

import supertest from "supertest";

export function createTestServer(
  handler: (request: Request) => Promise<Response>
) {
  const server = http.createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];

      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }

      const body = Buffer.concat(chunks).toString();
      const headers = new Headers();

      for (const [key, value] of Object.entries(req.headers)) {
        if (!value) {
          continue;
        }

        if (Array.isArray(value)) {
          value.forEach((entry) => headers.append(key, entry));
        } else {
          headers.set(key, value);
        }
      }

      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers,
        body:
          body && req.method && !["GET", "HEAD"].includes(req.method)
            ? body
            : undefined,
      });

      const response = await handler(request);

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.end(await response.text());
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(error) }));
    }
  });

  return {
    server,
    request: supertest(server),
  };
}
