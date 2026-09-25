import { initTRPC, TRPCError } from "@trpc/server";
import { Context } from "./context";
import { verifyToken, verifySignature } from "@/lib/tokenService";
import { FORM_TYPE_HEADER, type ClientFormType, type TokenFailureReason } from "@/lib/tokenAccess";

/** Rechazo de un enlace de cliente; el motivo viaja al navegador en `data.tokenReason`. */
export class TokenAccessError extends Error {
  constructor(public readonly reason: TokenFailureReason, message: string) {
    super(message);
    this.name = "TokenAccessError";
  }
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause && error.cause.name === "ZodError" ? error.cause : null,
        tokenReason: error.cause instanceof TokenAccessError ? error.cause.reason : null,
      },
    };
  },
});

/**
 * Middleware: Logging
 * Logs metadata about each incoming request, its duration, and any errors thrown.
 */
const loggerMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  console.log(`[tRPC Request] Path: ${path} | Type: ${type} | IP: ${ctx.ip}`);
  
  const result = await next();
  const duration = Date.now() - start;

  if (!result.ok) {
    console.error(
      `[tRPC Error] Path: ${path} | Duration: ${duration}ms | Code: ${result.error.code} | Message: ${result.error.message}`
    );
  } else {
    console.log(`[tRPC Success] Path: ${path} | Duration: ${duration}ms`);
  }

  return result;
});

/**
 * Middleware: Client Token Authorization
 * Requires a valid client token passed via the Authorization header or x-client-token header.
 */
const isClientTokenAuthorized = t.middleware(async ({ next, ctx }) => {
  const authHeader = ctx.req.headers.get("authorization") || ctx.req.headers.get("x-client-token");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    const message = "Se requiere un token de acceso del cliente para este procedimiento";
    throw new TRPCError({ code: "UNAUTHORIZED", message, cause: new TokenAccessError("INVALID", message) });
  }

  const verification = await verifyToken(token);
  if (!verification.success) {
    const message = verification.error || "Token de acceso del cliente inválido o expirado";
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message,
      cause: new TokenAccessError(verification.reason || "INVALID", message),
    });
  }

  // Cada página declara qué formulario tiene abierto: un enlace de persona natural
  // no sirve en persona jurídica ni al revés. El tipo del enlace es el del borrador
  // que se registró al generarlo (Token.type es siempre ACCESS); los borradores
  // locales lo llevan en el prefijo (draft-nat- / draft-jur-).
  const headerValue = ctx.req.headers.get(FORM_TYPE_HEADER)?.toUpperCase();
  const pageFormType: ClientFormType | undefined =
    headerValue === "NATURAL" || headerValue === "JURIDICA" ? headerValue : undefined;

  let linkFormType: ClientFormType | undefined =
    verification.type === "NATURAL" || verification.type === "JURIDICA" ? verification.type : undefined;
  if (pageFormType && !linkFormType && verification.uuid) {
    const draft = await ctx.prisma.draft.findUnique({
      where: { token: verification.uuid },
      select: { type: true },
    });
    linkFormType = draft?.type;
  }

  if (pageFormType && linkFormType && pageFormType !== linkFormType) {
    const message = `Este enlace corresponde al formulario de ${linkFormType === "NATURAL" ? "Persona Natural" : "Persona Jurídica"}`;
    throw new TRPCError({ code: "FORBIDDEN", message, cause: new TokenAccessError("WRONG_FORM", message) });
  }

  return next({
    ctx: {
      ...ctx,
      client: {
        crmContactId: verification.crmContactId,
        type: verification.type,
        tokenUuid: verification.uuid,
        /** NATURAL / JURIDICA del enlace (o de la página si el enlace aún no tiene borrador). */
        formType: linkFormType ?? pageFormType,
      },
    },
  });
});

/**
 * Middleware: Admin Authorization
 * Requires an admin token passed via x-admin-token or Authorization header.
 * Verified cryptographically against our HMAC-SHA256 signature and checks role in database.
 */
const isAdminAuthorized = t.middleware(async ({ next, ctx }) => {
  let adminToken = ctx.req.headers.get("x-admin-token") || ctx.req.headers.get("authorization")?.replace("Bearer ", "");

  if (!adminToken) {
    adminToken = ctx.req.cookies.get("admin_session")?.value;
  }

  if (!adminToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Se requiere un token de administrador para este procedimiento",
    });
  }

  // Developer bypass token allowed in development and test mode
  if ((process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && adminToken === "admin-secret-dev") {
    return next({
      ctx: {
        ...ctx,
        admin: {
          id: "dev-admin-id",
          email: "admin@udg.com",
          name: "Dev Admin",
          role: "ADMIN" as const,
        },
      },
    });
  }

  const parts = adminToken.split(".");
  if (parts.length !== 2) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Formato de token de administrador inválido",
    });
  }

  const [adminUserId, signature] = parts;
  const isSignatureValid = verifySignature(adminUserId, signature);
  if (!isSignatureValid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Firma de token de administrador inválida (integridad fallida)",
    });
  }

  // Find the administrator in the database
  const admin = await ctx.prisma.adminUser.findUnique({
    where: { id: adminUserId },
  });

  if (!admin || admin.deletedAt !== null) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Administrador no encontrado o inactivo",
    });
  }

  if (admin.role !== "ADMIN" && admin.role !== "SUPERADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado: Se requiere rol de administrador o superadministrador",
    });
  }

  return next({
    ctx: {
      ...ctx,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure.use(loggerMiddleware);
export const tokenProcedure = t.procedure.use(loggerMiddleware).use(isClientTokenAuthorized);
export const adminProcedure = t.procedure.use(loggerMiddleware).use(isAdminAuthorized);
