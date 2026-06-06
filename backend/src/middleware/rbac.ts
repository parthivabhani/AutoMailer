/**
 * rbac.ts — Resource-based permission middleware
 *
 * Fine-grained permission system beyond simple role checks.
 * Permissions are defined per role in constants.ts and can be
 * overridden per-sender via sender_policies table.
 *
 * Usage:
 *   router.post("/campaigns", requirePermission("campaigns:create"), handler)
 */

import type { Request, Response, NextFunction } from "express";
import { InsufficientPermissionsError, UnauthorizedError } from "../shared/errors.js";
import type { AuthenticatedRequest } from "../shared/types.js";
import type { Role } from "../config/constants.js";

// ── Permission Definitions ────────────────────────────────────────────────────

export type Permission =
  // Sender management
  | "senders:create"
  | "senders:delete"
  | "senders:read"
  | "senders:update"
  // Campaign management
  | "campaigns:create"
  | "campaigns:read"
  | "campaigns:update"
  | "campaigns:delete"
  | "campaigns:launch"
  | "campaigns:schedule"
  | "campaigns:pause"
  // Contact / CSV management
  | "contacts:upload"
  | "contacts:read"
  | "contacts:segment"
  | "contacts:assign"
  | "contacts:vip"
  // SMTP
  | "smtp:configure"
  | "smtp:read"
  // Templates
  | "templates:create"
  | "templates:read"
  | "templates:update"
  | "templates:delete"
  // Analytics
  | "analytics:read"
  | "analytics:export"
  // Billing
  | "billing:read"
  | "billing:manage"
  // Policies
  | "policies:manage"
  | "policies:read"
  // Attachments
  | "attachments:upload"
  | "attachments:delete"
  // Admin management (super-admin only)
  | "admin:create"
  | "admin:manage"
  | "admin:read"
  // Platform (super-admin only)
  | "business:suspend"
  | "business:manage"
  | "platform:stats"
  | "platform:ai_usage"
  | "platform:billing";

// ── Role → Permission Map ─────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, Permission[] | ["*"]> = {
  super_admin: ["*"], // Wildcard — all permissions

  admin: [
    "senders:create", "senders:delete", "senders:read", "senders:update",
    "campaigns:create", "campaigns:read", "campaigns:update", "campaigns:delete",
    "campaigns:launch", "campaigns:schedule", "campaigns:pause",
    "contacts:upload", "contacts:read", "contacts:segment", "contacts:assign", "contacts:vip",
    "smtp:configure", "smtp:read",
    "templates:create", "templates:read", "templates:update", "templates:delete",
    "analytics:read", "analytics:export",
    "billing:read",
    "policies:manage", "policies:read",
  ],

  sender: [
    "campaigns:launch", "campaigns:read", "campaigns:pause",
    "contacts:read",
    "templates:read", "templates:create", "templates:update",
    "analytics:read",
    "policies:read",
    // Note: attachments:upload granted only via sender_policies.can_use_attachments
  ],
};

// ── Permission Check Helper ───────────────────────────────────────────────────

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms[0] === "*") return true; // super_admin wildcard
  return (perms as Permission[]).includes(permission);
}

// ── Middleware Factory ────────────────────────────────────────────────────────

/**
 * Middleware that enforces a specific permission is held by the authenticated user.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(new UnauthorizedError());
    }

    const { role } = authReq.user;

    if (!hasPermission(role, permission)) {
      return next(new InsufficientPermissionsError(permission));
    }

    next();
  };
}

/**
 * Middleware that enforces ALL listed permissions are held.
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(new UnauthorizedError());
    }

    const { role } = authReq.user;
    const missing = permissions.filter((p) => !hasPermission(role, p));

    if (missing.length > 0) {
      return next(new InsufficientPermissionsError(missing.join(", ")));
    }

    next();
  };
}

/**
 * Middleware that enforces AT LEAST ONE listed permission is held.
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(new UnauthorizedError());
    }

    const { role } = authReq.user;
    const hasAny = permissions.some((p) => hasPermission(role, p));

    if (!hasAny) {
      return next(new InsufficientPermissionsError(permissions.join(" OR ")));
    }

    next();
  };
}
