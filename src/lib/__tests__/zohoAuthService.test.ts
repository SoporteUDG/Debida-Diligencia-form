import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { 
  getAccessToken, 
  isTokenValid, 
  clearCache, 
  redactSecrets, 
  executeWithRetry 
} from "../zohoAuthService";

describe("ZohoAuthService Unit Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    clearCache();
    
    // Set standard credentials in env for mock testing
    process.env.ZOHO_CLIENT_ID = "real_client_id_123456";
    process.env.ZOHO_CLIENT_SECRET = "real_client_secret_abcdef";
    process.env.ZOHO_REFRESH_TOKEN = "real_refresh_token_xyz987";
    process.env.ZOHO_OAUTH_BASE_URL = "https://accounts.zoho.com";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe("redactSecrets", () => {
    it("should redact actual secrets from message string", () => {
      const msg = "Error: client_secret real_client_secret_abcdef or refresh_token real_refresh_token_xyz987 is invalid.";
      const redacted = redactSecrets(msg);
      
      expect(redacted).not.toContain("real_client_secret_abcdef");
      expect(redacted).not.toContain("real_refresh_token_xyz987");
      expect(redacted).toContain("[REDACTED_SECRET]");
    });

    it("should not modify other content or placeholder text", () => {
      process.env.ZOHO_CLIENT_SECRET = "placeholder_client_secret";
      const msg = "Error: client_secret placeholder_client_secret is invalid.";
      const result = redactSecrets(msg);
      
      expect(result).toBe(msg); // Placeholder shouldn't be redacted
    });
  });

  describe("isTokenValid & clearCache", () => {
    it("should return false when cache is empty", () => {
      expect(isTokenValid()).toBe(false);
    });

    it("should return false when token expires in less than 5 minutes", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "test_token_123",
          expires_in: 3600, // 1 hour
        }),
      } as any);

      const token = await getAccessToken();
      expect(token).toBe("test_token_123");
      expect(isTokenValid()).toBe(true);

      // Advance time by 56 minutes (leaving 4 minutes remaining)
      vi.advanceTimersByTime(56 * 60 * 1000);
      expect(isTokenValid()).toBe(false);
    });

    it("should invalidate the token when clearCache is called", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "test_token_abc",
          expires_in: 3600,
        }),
      } as any);

      await getAccessToken();
      expect(isTokenValid()).toBe(true);

      clearCache();
      expect(isTokenValid()).toBe(false);
    });
  });

  describe("getAccessToken", () => {
    it("should generate a mocked token in placeholder mode", async () => {
      // Set to placeholder credentials
      process.env.ZOHO_CLIENT_ID = "placeholder_client_id";
      process.env.ZOHO_CLIENT_SECRET = "placeholder_client_secret";
      process.env.ZOHO_REFRESH_TOKEN = "placeholder_refresh_token";

      const spyFetch = vi.spyOn(global, "fetch");

      const token = await getAccessToken();
      expect(token).toBeDefined();
      expect(token).toContain("mocked_zoho_access_token_");
      expect(isTokenValid()).toBe(true);

      // Fetch should never be called in placeholder mode
      expect(spyFetch).not.toHaveBeenCalled();
    });

    it("should fetch token from Zoho OAuth endpoint when not cached", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "z_access_token_999",
          expires_in: 1800,
        }),
      } as any);

      const token = await getAccessToken();
      expect(token).toBe("z_access_token_999");
      expect(spyFetch).toHaveBeenCalledTimes(1);
      
      const [url, requestInit] = spyFetch.mock.calls[0];
      expect(url).toBe("https://accounts.zoho.com/oauth/v2/token");
      expect(requestInit?.method).toBe("POST");
      expect(requestInit?.body).toContain("grant_type=refresh_token");
      expect(requestInit?.body).toContain("client_id=real_client_id_123456");
    });
  });

  describe("executeWithRetry wrapper", () => {
    it("should execute API function successfully on first attempt if token is valid", async () => {
      // Warm up cache
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "valid_token", expires_in: 3600 }),
      } as any);

      const apiCall = vi.fn().mockResolvedValue("API_SUCCESS");

      const result = await executeWithRetry(apiCall);
      expect(result).toBe("API_SUCCESS");
      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith("valid_token");
    });

    it("should refresh token and retry call exactly once when 401 Unauthorized is encountered", async () => {
      // Mock OAuth refreshes (first returning token1, second returning token2 after invalidation)
      let tokenCounter = 1;
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            access_token: `token_${tokenCounter++}`,
            expires_in: 3600,
          }),
        } as any;
      });

      // API call fails with 401 on first token, succeeds on second token
      let callCount = 0;
      const apiCall = vi.fn().mockImplementation(async (token) => {
        callCount++;
        if (callCount === 1) {
          expect(token).toBe("token_1");
          throw new Error("HTTP 401 Unauthorized token has expired");
        }
        expect(token).toBe("token_2");
        return "RETRY_SUCCESS";
      });

      const result = await executeWithRetry(apiCall);
      expect(result).toBe("RETRY_SUCCESS");
      expect(apiCall).toHaveBeenCalledTimes(2);
      expect(spyFetch).toHaveBeenCalledTimes(2); // Initial fetch + refresh on 401
    });

    it("should not retry infinitely and throw final error if second attempt fails", async () => {
      // Mock OAuth refresh returning same token or another
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "token_fixed", expires_in: 3600 }),
      } as any);

      // API call fails with 401 consistently
      const apiCall = vi.fn().mockRejectedValue(new Error("HTTP 401 Unauthorized still failing"));

      await expect(executeWithRetry(apiCall)).rejects.toThrow(
        "[Zoho Auth Retry Failure] Falló el reintento de la llamada Zoho API"
      );
      
      // Should stop after 2 attempts
      expect(apiCall).toHaveBeenCalledTimes(2);
    });
  });
});
