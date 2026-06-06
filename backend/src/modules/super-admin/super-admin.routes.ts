/**
 * super-admin.routes.ts — Refactored super-admin endpoints
 */

import { Router, type Response } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/requestValidator.js";
import { UpdateAdminStatusSchema } from "./super-admin.schema.js";
import { superAdminService } from "./super-admin.service.js";
import { sendSuccess, sendError } from "../../shared/response.js";
import type { AuthenticatedRequest } from "../../shared/types.js";

const router = Router();

// Apply auth middleware to all Super Admin endpoints
router.use(requireAuth, requireRole(["super_admin"]));

// GET /super-admin/admins — List all administrators
router.get("/admins", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admins = await superAdminService.getAdmins();
    return sendSuccess(res, admins);
  } catch (err: any) {
    return sendError(res, 500, "FETCH_ERROR", err.message || "Failed to retrieve administrators.");
  }
});

// PATCH /super-admin/admins/:id/status — Toggle status of admin profile
router.patch(
  "/admins/:id/status",
  validate(UpdateAdminStatusSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
      const result = await superAdminService.updateAdminStatus(id, status);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, 500, "UPDATE_ERROR", err.message || "Failed to update admin account status.");
    }
  }
);

// GET /super-admin/stats — Retrieve server stats
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await superAdminService.getStats();
    return sendSuccess(res, stats);
  } catch (err: any) {
    return sendError(res, 500, "STATS_ERROR", err.message || "Failed to fetch platform metrics.");
  }
});

export default router;
