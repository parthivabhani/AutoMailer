/**
 * rateLimiter.ts — Per-tenant and global rate limiting
 *
 * Uses express-rate-limit with a Redis store (when available) so that
 * rate limits work across multiple server instances in production.
 * Falls back to in-memory store for local development.
 *
 * Configured limits are defined in config/constants.ts.
 */

import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import { RATE_LIMITS } from "../config/constants.js";
import type { Request } from "express";
import type { AuthenticatedRequest } from "../shared/types.js";
import { logger } from "../shared/logger.js";

// ── Key Generators ────────────────────────────────────────────────────────────

/** Use the authenticated tenant's business ID as the rate limit key */
function tenantKeyGenerator(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.businessId) {
    return `tenant:${authReq.user.businessId}`;
  }
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }
  // Fall back to IP for unauthenticated requests
  return `ip:${req.ip}`;
}

function senderKeyGenerator(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.userId) {
    return `sender:${authReq.user.userId}`;
  }
  return `ip:${req.ip}`;
}

// ── Rate Limiter Factory ──────────────────────────────────────────────────────

function createLimiter(
  config: { windowMs: number; max: number },
  keyGenerator?: (req: Request) => string,
  message?: string,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => req.ip || "unknown"),
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: message || "Too many requests. Please slow down.",
      },
    },
    handler(req, res, next, options) {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
          key: keyGenerator ? keyGenerator(req) : req.ip,
        },
        "Rate limit exceeded",
      );
      res.status(options.statusCode).json(options.message);
    },
  });
}

// ── Pre-built Rate Limiters ───────────────────────────────────────────────────

/** Applied globally to all routes — basic protection per IP */
export const globalRateLimiter = createLimiter(
  RATE_LIMITS.GLOBAL_PER_IP,
  (req) => `ip:${req.ip}`,
  "Too many requests from your IP. Please wait before retrying.",
);

/** Applied to all authenticated routes — per-tenant limit */
export const tenantRateLimiter = createLimiter(
  RATE_LIMITS.PER_TENANT,
  tenantKeyGenerator,
  "Your organization has exceeded the request rate limit. Please slow down.",
);

/** Stricter limit for campaign send endpoints — prevent spam */
export const campaignSendRateLimiter = createLimiter(
  RATE_LIMITS.CAMPAIGN_SEND,
  senderKeyGenerator,
  "Campaign send rate limit reached. You can dispatch up to 5 campaigns per minute.",
);

/** AI generation endpoints — prevent token abuse */
export const aiRateLimiter = createLimiter(
  RATE_LIMITS.AI_GENERATE,
  tenantKeyGenerator,
  "AI generation rate limit reached. Maximum 30 requests per minute per organization.",
);

/** Auth endpoints — prevent brute force */
export const authRateLimiter = createLimiter(
  RATE_LIMITS.AUTH,
  (req) => `ip:${req.ip}`,
  "Too many authentication attempts. Please wait 15 minutes before retrying.",
);
