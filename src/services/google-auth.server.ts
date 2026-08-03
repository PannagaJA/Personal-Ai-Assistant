import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/services/logger";

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_at: string;
}

export class GoogleAuthService {
  /**
   * Retrieves a valid Google Access Token for the user.
   * Automatically refreshes expired tokens using Google OAuth endpoint if a refresh_token is present.
   */
  static async getValidAccessToken(supabase: SupabaseClient, userId: string): Promise<string | null> {
    try {
      // 1. Check active Supabase Session provider token first for fresh OAuth scopes
      const { data: sessionData } = await supabase.auth.getSession();
      const providerToken = sessionData.session?.provider_token;
      const providerRefreshToken = sessionData.session?.provider_refresh_token;

      if (providerToken && sessionData.session?.user?.id === userId) {
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        await supabase.from("user_google_tokens").upsert({
          user_id: userId,
          access_token: providerToken,
          ...(providerRefreshToken ? { refresh_token: providerRefreshToken } : {}),
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        });
        return providerToken;
      }

      // 2. Check database for stored token
      const { data: dbToken, error } = await supabase
        .from("user_google_tokens")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !dbToken) {
        logger.warn("provider", "No Google token found for user", { userId });
        return null;
      }

      const expiresAtTime = new Date(dbToken.expires_at).getTime();
      const isExpired = Date.now() >= expiresAtTime - 60000; // 1 minute buffer

      if (!isExpired) {
        return dbToken.access_token;
      }

      // Token expired — try refreshing if refresh_token exists
      if (!dbToken.refresh_token) {
        logger.warn("provider", "Google token expired and no refresh token available", { userId });
        return null;
      }

      logger.info("provider", "Refreshing expired Google token", { userId });
      const refreshed = await this.refreshAccessToken(dbToken.refresh_token);

      if (!refreshed) {
        logger.error("provider", "Failed to refresh Google token", { userId });
        return null;
      }

      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString();

      await supabase.from("user_google_tokens").update({
        access_token: refreshed.access_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);

      return refreshed.access_token;
    } catch (err) {
      logger.error("provider", "Error fetching Google access token", { error: String(err) }, userId);
      return null;
    }
  }

  private static async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
    const clientId = process.env["GOOGLE_CLIENT_ID"] || process.env["VITE_GOOGLE_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];

    if (!clientId || !clientSecret) {
      logger.error("provider", "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET for token refresh");
      return null;
    }

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("provider", "Google token endpoint returned error", { status: response.status, body: errorText });
        return null;
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        expires_in: data.expires_in ?? 3600,
      };
    } catch (err) {
      logger.error("provider", "Exception during Google token refresh", { error: String(err) });
      return null;
    }
  }
}
