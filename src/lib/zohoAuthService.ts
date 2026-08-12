import crypto from "crypto";

interface TokenCache {
  accessToken: string | null;
  expiresAt: number; // timestamp in milliseconds
}

// In-memory token cache
const tokenCache: TokenCache = {
  accessToken: null,
  expiresAt: 0,
};

/**
 * Helper function to redact Zoho client credentials and secrets from logs and error messages.
 * Prevents accidental leak of client_secret or refresh_tokens.
 */
export function redactSecrets(msg: string): string {
  if (!msg) return msg;

  const secrets = [
    process.env.ZOHO_CLIENT_ID,
    process.env.ZOHO_CLIENT_SECRET,
    process.env.ZOHO_REFRESH_TOKEN,
  ].filter(Boolean) as string[];

  let redacted = msg;
  for (const secret of secrets) {
    // Only redact real secrets (avoiding placeholders)
    if (secret && secret.length > 5 && !secret.includes("placeholder")) {
      const escaped = secret.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(escaped, "g");
      redacted = redacted.replace(regex, "[REDACTED_SECRET]");
    }
  }
  return redacted;
}

/**
 * Checks if the cached access token is present and has at least 5 minutes of remaining life.
 */
export function isTokenValid(): boolean {
  const now = Date.now();
  return !!tokenCache.accessToken && tokenCache.expiresAt > now + 300 * 1000;
}

/**
 * Manually invalidates/clears the cached access token.
 * Should be called when a downstream api request fails with a 401 Unauthorized code.
 */
export function clearCache() {
  tokenCache.accessToken = null;
  tokenCache.expiresAt = 0;
  console.log("[Zoho Auth] Caché de token Zoho invalidada.");
}

/**
 * Retrieves a valid Zoho OAuth2 Access Token.
 * Reuses the cached token if valid, otherwise requests a new one from Zoho OAuth.
 * If credentials are placeholders (development mode), returns a mock/simulated token.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (isTokenValid() && tokenCache.accessToken) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const oauthBaseUrl = process.env.ZOHO_OAUTH_BASE_URL || "https://accounts.zoho.com";

  // Check if configuration uses local/development placeholders
  const isPlaceholder =
    !clientId ||
    clientId === "placeholder_client_id" ||
    !clientSecret ||
    clientSecret === "placeholder_client_secret" ||
    !refreshToken ||
    refreshToken === "placeholder_refresh_token";

  if (isPlaceholder) {
    console.log("[Zoho Auth] Modo desarrollo/placeholder activo. Simulando token de acceso Zoho.");
    tokenCache.accessToken = "mocked_zoho_access_token_" + crypto.randomUUID();
    tokenCache.expiresAt = Date.now() + 3600 * 1000; // Valid for 1 hour
    return tokenCache.accessToken;
  }

  console.log("[Zoho Auth] Obteniendo nuevo token de acceso Zoho OAuth...");
  const tokenUrl = `${oauthBaseUrl}/oauth/v2/token`;
  
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("client_id", clientId!);
  params.append("client_secret", clientSecret!);
  params.append("refresh_token", refreshToken!);

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zoho API retornó código HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Error retornado por Zoho OAuth API: ${data.error}`);
    }

    if (!data.access_token) {
      throw new Error("La respuesta de Zoho OAuth no contiene access_token.");
    }

    tokenCache.accessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    tokenCache.expiresAt = Date.now() + expiresIn * 1000;

    console.log("[Zoho Auth] Nuevo token de acceso Zoho obtenido y cacheado.");
    return data.access_token;
  } catch (error: any) {
    const errMsg = error.message || String(error);
    const redactedMsg = redactSecrets(errMsg);
    console.error("[Zoho Auth Error] Falló la renovación del token de acceso:", redactedMsg);
    throw new Error(`Error en autenticación Zoho: ${redactedMsg}`);
  }
}

/**
 * Generic retry wrapper for Zoho API calls.
 * Executes the provided function with a valid access token.
 * If the function throws an authorization error (e.g. 401, expired token, invalid ticket),
 * it clears the token cache, fetches a fresh token, and retries the call exactly once.
 *
 * @param apiCallFn Callback executing the API call, receiving the current access token.
 */
export async function executeWithRetry<T>(
  apiCallFn: (accessToken: string) => Promise<T>
): Promise<T> {
  let token = await getAccessToken();
  try {
    return await apiCallFn(token);
  } catch (error: any) {
    const errorMsg = (error.message || String(error)).toLowerCase();

    // Identify common authorization expired error triggers (Zoho HTTP 401, invalid_ticket from WorkDrive)
    const isAuthError =
      errorMsg.includes("401") ||
      errorMsg.includes("unauthorized") ||
      errorMsg.includes("invalid token") ||
      errorMsg.includes("invalid_ticket") ||
      errorMsg.includes("invalid credentials");

    if (isAuthError) {
      console.warn("[Zoho Auth Retry] Error de autorización detectado. Renovando caché de token y reintentando...");
      clearCache();
      
      // Request fresh token
      token = await getAccessToken();

      // Retry exactly once
      try {
        return await apiCallFn(token);
      } catch (retryError: any) {
        const redactedMsg = redactSecrets(retryError.message || String(retryError));
        throw new Error(`[Zoho Auth Retry Failure] Falló el reintento de la llamada Zoho API: ${redactedMsg}`);
      }
    }

    // Return redacted error for any other API failures
    const redactedMsg = redactSecrets(error.message || String(error));
    throw new Error(redactedMsg);
  }
}
