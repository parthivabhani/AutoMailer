/**
 * auth.service.ts — Authentication and profile self-healing service
 */

import { getSupabase, getSupabaseAdmin } from "../../config/supabase.js";
import { UnauthorizedError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";

interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    smtpConfigured: boolean;
    businessId?: string;
    adminId?: string;
  };
}

export class AuthService {
  /**
   * Performs user login via Supabase auth, validates profile,
   * and runs self-healing logic if profile is missing.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const supabase = getSupabase();

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr || !authData.session || !authData.user) {
      logger.warn({ email, err: authErr?.message }, "Auth credentials rejection");
      throw new UnauthorizedError(authErr?.message || "Invalid email or password.");
    }

    const token = authData.session.access_token;
    const userId = authData.user.id;

    // 2. Fetch user profile
    let { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      logger.warn({ userId, email }, "Profile not found on login. Executing self-healing...");

      // Self-healing: create profile cleanly
      const { data: newProfile, error: createErr } = await getSupabaseAdmin()
        .from("profiles")
        .insert({
          id: userId,
          name: authData.user.user_metadata?.name || "User",
          email: authData.user.email || email,
          role: "sender", // Safe default role
          status: "active",
        })
        .select()
        .single();

      if (!createErr && newProfile) {
        profile = newProfile;
      } else {
        logger.error({ createErr, userId }, "Profile self-healing failed");
        // Fallback default in-memory response so user is not blocked
        return {
          token,
          user: {
            id: userId,
            email: authData.user.email || email,
            name: "User",
            role: "sender",
            smtpConfigured: false,
          },
        };
      }
    }

    return {
      token,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        smtpConfigured: profile.smtp_configured || false,
        businessId: profile.business_id,
        adminId: profile.admin_id,
      },
    };
  }

  /**
   * Log out a user session.
   */
  async logout(token: string): Promise<void> {
    const supabase = getSupabase();
    // In Supabase, signOut requires the client context.
    // If we have custom session management, we can invalidate it here.
    await supabase.auth.signOut();
  }
}

export const authService = new AuthService();
