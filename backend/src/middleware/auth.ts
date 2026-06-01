/**
 * auth.ts — Enhanced authentication middleware
 *
 * Upgrades the existing auth middleware with:
 * - Tenant context (businessId) attached to every request
 * - Profile caching to reduce DB round-trips (Redis or in-memory)
 * - Business suspension check
 * - Consistent use of AppError types
 */

import type { Request, Response, NextFunction } from "express";
import { getSupabase } from "../config/supabase.js";
import { InvalidTokenError, ForbiddenError, UnauthorizedError } from "../shared/errors.js";
import type { AuthenticatedRequest, TenantContext } from "../shared/types.js";
import type { Role } from "../config/constants.js";
import { logger } from "../shared/logger.js";

// ── In-memory profile cache (L1 cache — fallback when Redis unavailable) ───────
// Profile data is cached for 60 seconds to avoid repeated Supabase lookups.

interface CachedProfile {
  profile: TenantContext;
  expiresAt: number;
}

const profileCache = new Map<string, CachedProfile>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCachedProfile(userId: string): TenantContext | null {
  const cached = profileCache.get(userId);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    profileCache.delete(userId);
    return null;
  }
  return cached.profile;
}

function setCachedProfile(userId: string, profile: TenantContext): void {
  profileCache.set(userId, {
    profile,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  // Evict when cache grows too large (simple LRU-ish eviction)
  if (profileCache.size > 1_000) {
    const firstKey = profileCache.keys().next().value;
    if (firstKey) profileCache.delete(firstKey);
  }
}

function invalidateProfileCache(userId: string): void {
  profileCache.delete(userId);
}

// ── Main Auth Middleware ───────────────────────────────────────────────────────

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing or invalid Authorization header. Expected: Bearer <token>"));
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(new UnauthorizedError("Bearer token is empty"));
  }

  try {
    // 1. Verify JWT with Supabase Auth
    const { data: { user }, error } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      return next(new InvalidTokenError(error?.message || "Invalid or expired token"));
    }

    // 2. Check profile cache first
    let tenantContext = getCachedProfile(user.id);

    if (!tenantContext) {
      // 3. Fetch profile + business data from DB
      const { data: profile, error: profileErr } = await getSupabase()
        .from("profiles")
        .select(`
          id,
          email,
          name,
          role,
          status,
          admin_id,
          business_id,
          smtp_configured,
          permissions
        `)
        .eq("id", user.id)
        .single();

      if (profileErr || !profile) {
        logger.warn({ userId: user.id }, "Profile not found during auth");
        return next(new ForbiddenError("Profile not found. Please contact your administrator."));
      }

      // 4. Check if profile is suspended
      if (profile.status === "suspended") {
        return next(new ForbiddenError("Your account has been suspended. Please contact support."));
      }

      // 5. If profile has a business, check if business is suspended
      if (profile.business_id) {
        const { data: business } = await getSupabase()
          .from("businesses")
          .select("status, suspended_reason")
          .eq("id", profile.business_id)
          .single();

        if (business?.status === "suspended") {
          return next(
            new ForbiddenError(
              `Your organization has been suspended${
                business.suspended_reason ? `: ${business.suspended_reason}` : ""
              }. Please contact support.`
            )
          );
        }
      }

      tenantContext = {
        userId: profile.id,
        id: profile.id, // backward-compat alias
        email: profile.email,
        name: profile.name,
        role: profile.role as Role,
        businessId: profile.business_id || undefined,
        adminId: profile.admin_id || undefined,
        smtpConfigured: profile.smtp_configured || false,
      };

      setCachedProfile(user.id, tenantContext);
    }

    // 6. Attach tenant context and raw token to request
    (req as AuthenticatedRequest).user = tenantContext;
    (req as AuthenticatedRequest).token = token;

    // 7. Update last_active_at asynchronously (don't block the request)
    const updatePromise = getSupabase()
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", user.id);
    Promise.resolve(updatePromise).catch((err: any) =>
      logger.warn({ err, userId: user.id }, "Failed to update last_active_at")
    );

    next();
  } catch (err) {
    logger.error({ err }, "Auth middleware unexpected error");
    next(err);
  }
}

// ── Role Guard Middleware ─────────────────────────────────────────────────────

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    if (!roles.includes(authReq.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Requires one of: [${roles.join(", ")}]. Your role: ${authReq.user.role}`
        )
      );
    }

    next();
  };
}

// ── Exports for backward compatibility ───────────────────────────────────────

export type { AuthenticatedRequest };
export { invalidateProfileCache };
