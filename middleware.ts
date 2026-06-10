import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PAGE_PREFIXES = ["/home", "/timeline", "/profile", "/search"];

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/");
}

function extractToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  const cookieToken = request.cookies.get("token")?.value;
  return cookieToken ?? null;
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function verifyTokenEdge(
  token: string
): Promise<{ userId: string } | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = encoder.encode(`${header}.${payload}`);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      data
    );

    if (!isValid) {
      return null;
    }

    const decodedPayload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload))
    ) as { userId?: string; exp?: number };

    if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
      return null;
    }

    if (
      !decodedPayload.userId ||
      typeof decodedPayload.userId !== "string"
    ) {
      return null;
    }

    return { userId: decodedPayload.userId };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPage = isProtectedPage(pathname);
  const isApi = isProtectedApi(pathname);

  if (!isPage && !isApi) {
    return NextResponse.next();
  }

  const token = extractToken(request);
  const session = token ? await verifyTokenEdge(token) : null;

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/timeline/:path*",
    "/profile/:path*",
    "/search/:path*",
    "/api/:path*",
  ],
};
