/**
 * admin.routes.ts — Refactored admin endpoints
 */

import { Router, type Response } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/requestValidator.js";
import { CreateSenderSchema, SmtpConfigSchema, LogQuerySchema } from "./admin.schema.js";
import { adminService } from "./admin.service.js";
import { sendSuccess, sendCreated, sendError } from "../../shared/response.js";
import type { AuthenticatedRequest } from "../../shared/types.js";
import contactsRouter from "../contacts/contacts.routes.js";

const router = Router();

// Apply auth middleware to all Admin endpoints
router.use(requireAuth, requireRole(["admin"]));

// Mount contacts router for CSV list management under /admin/csv
router.use("/csv", contactsRouter);

// GET /admin/stats
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;
  const businessId = req.user!.businessId || adminId;

  try {
    const stats = await adminService.getStats(adminId, businessId);
    return sendSuccess(res, stats);
  } catch (err: any) {
    return sendError(res, 500, "STATS_ERROR", err.message || "Failed to retrieve statistics.");
  }
});

// GET /admin/senders
router.get("/senders", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;

  try {
    const senders = await adminService.getSenders(adminId);
    return sendSuccess(res, senders);
  } catch (err: any) {
    return sendError(res, 500, "FETCH_ERROR", err.message || "Failed to retrieve senders.");
  }
});

// POST /admin/senders
router.post(
  "/senders",
  validate(CreateSenderSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;

    try {
      const sender = await adminService.createSender(adminId, businessId, req.body);
      return sendCreated(res, sender);
    } catch (err: any) {
      return sendError(
        res,
        err.statusCode || 500,
        err.code || "CREATE_ERROR",
        err.message || "Failed to create sender account.",
      );
    }
  },
);

// DELETE /admin/senders/:id
router.delete("/senders/:id", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;
  const { id } = req.params;

  try {
    await adminService.deleteSender(adminId, id);
    return sendSuccess(res, { ok: true });
  } catch (err: any) {
    return sendError(
      res,
      err.statusCode || 500,
      err.code || "DELETE_ERROR",
      err.message || "Failed to delete sender account.",
    );
  }
});

// GET /admin/logs
router.get("/logs", validate(LogQuerySchema), async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;

  try {
    const logs = await adminService.getLogs(adminId, req.query);
    return sendSuccess(res, logs);
  } catch (err: any) {
    return sendError(res, 500, "FETCH_ERROR", err.message || "Failed to retrieve email logs.");
  }
});

// POST /admin/smtp
router.post(
  "/smtp",
  validate(SmtpConfigSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const { gmail, appPassword } = req.body;

    try {
      const result = await adminService.setSmtpConfig(adminId, gmail, appPassword);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(
        res,
        500,
        "SMTP_ERROR",
        err.message || "Failed to configure SMTP credentials.",
      );
    }
  },
);

export default router;
