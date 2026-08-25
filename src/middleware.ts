import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// In-memory rate limiting map cache
const ipCache = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute window

function isRateLimited(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const clientData = ipCache.get(ip);
  if (!clientData) {
    ipCache.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + windowMs;
    return false;
  }
  clientData.count++;
  return clientData.count > limit;
}

/**
 * Converts a hex string into a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Validates the token signature cryptographically using Web Crypto API.
 * This ensures full compatibility with Next.js edge and middleware runtimes
 * without depending on Node.js-specific native modules.
 */
async function verifySessionToken(token: string): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [adminUserId, signature] = parts;

  if (!signature || signature.length !== 64) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const secret = process.env.TOKEN_SECRET || "default_token_secret_key_udg_2026";
    const keyData = encoder.encode(secret);
    
    // Import the secret key for HMAC verification
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = encoder.encode(adminUserId);
    const signatureBytes = hexToBytes(signature);

    // Cryptographically verify signature using Web Crypto HMAC
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as any,
      data as any
    );
  } catch (error) {
    console.error("[Middleware Crypto Error]:", error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate Limiter for API calls
  if (pathname.startsWith("/api")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || (request as any).ip || "127.0.0.1";
    const isLoginOrSubmit = pathname.includes("login") || pathname.includes("submit") || pathname.includes("upload");
    const limit = isLoginOrSubmit ? 20 : 100; // Stricter limit of 20 req/min for login/submit/upload
    
    if (isRateLimited(ip, limit, WINDOW_MS)) {
      console.warn(`[Middleware Security] Rate limit excedido para IP: ${ip} en la ruta: ${pathname}`);
      return new NextResponse(
        JSON.stringify({ success: false, error: "Demasiadas peticiones. Por favor intente más tarde (Límite excedido)." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Retry-After": "60",
          },
        }
      );
    }
  }

  // Protect all /admin routes (except /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const sessionCookie = request.cookies.get("admin_session")?.value;

    if (!sessionCookie || !(await verifySessionToken(sessionCookie))) {
      console.log(`[Middleware Security] Acceso denegado a ${pathname}. Redirigiendo a /admin/login`);
      
      // Redirect to login page
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
