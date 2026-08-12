import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export interface CreateContextOptions {
  req: NextRequest;
}

/**
 * Creates the tRPC context for each request.
 * Extracts client metadata (IP, user-agent) and passes down the request and Prisma Client.
 */
export async function createContext(opts: CreateContextOptions) {
  const req = opts.req;
  const headers = req.headers;

  const ip = headers.get("x-forwarded-for") || (req as any).ip || "127.0.0.1";
  const userAgent = headers.get("user-agent") || "unknown";

  return {
    req,
    prisma,
    ip,
    userAgent,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
