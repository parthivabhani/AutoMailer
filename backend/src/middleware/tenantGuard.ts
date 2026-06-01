/**
 * tenantGuard.ts — Strict multi-tenant isolation enforcer
 *
 * Ensures that every authenticated request is scoped to the correct
 * business_id. Applied after requireAuth to prevent cross-tenant data access.
 *
 * Also validates that route params like :senderId, :csvId, etc.
 * belong to the requesting tenant before proceeding.
 */

import type { Request, Response, NextFunction } from "express";
import { TenantIsolationError, ForbiddenError } from "../shared/errors.js";
import type { AuthenticatedRequest } from "../shared/types.js";

/**
 * Ensures the authenticated user has a businessId in their context.
 * Apply to all non-super-admin routes.
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return next(new ForbiddenError("Authentication required"));
  }

  // Super admins operate platform-wide, no business_id required
  if (authReq.user.role === "super_admin") {
    return next();
  }

  if (!authReq.user.businessId) {
    return next(
      new TenantIsolationError()
    );
  }

  next();
}

/**
 * Validates that a resource fetched from the database belongs to
 * the requesting tenant's business_id.
 *
 * Use this in service/repository layer checks, not directly as middleware.
 */
export function assertTenantOwnership(
  resourceBusinessId: string | undefined,
  requestingBusinessId: string | undefined
): void {
  if (!resourceBusinessId || !requestingBusinessId) {
    throw new TenantIsolationError();
  }

  if (resourceBusinessId !== requestingBusinessId) {
    throw new TenantIsolationError();
  }
}

/**
 * Validates that an admin's sender belongs to the same business/admin.
 */
export function assertSenderBelongsToAdmin(
  senderAdminId: string | null,
  requestingAdminId: string
): void {
  if (senderAdminId !== requestingAdminId) {
    throw new ForbiddenError("Sender does not belong to your organization.");
  }
}
