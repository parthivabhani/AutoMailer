/**
 * sender.routes.ts — Refactored sender endpoints
 */

import { Router, type Response } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/requestValidator.js";
import { ColdSendSchema } from "./sender.schema.js";
import { senderService } from "./sender.service.js";
import { sendSuccess, sendError } from "../../shared/response.js";
import type { AuthenticatedRequest } from "../../shared/types.js";

const router = Router();
router.use(requireAuth, requireRole(["sender", "admin"]));

// GET /sender/assigned — Get assigned contacts CSVs
router.get("/assigned", async (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.user!.userId;

  try {
    const assigned = await senderService.getAssigned(senderId);
    return sendSuccess(res, assigned);
  } catch (err: any) {
    return sendError(res, 500, "FETCH_ERROR", err.message || "Failed to retrieve assigned lists.");
  }
});

// POST /sender/send — ad-hoc outreach dispatch
router.post("/send", validate(ColdSendSchema), async (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.user!.userId;
  const adminId = req.user!.role === "admin" ? req.user!.userId : req.user!.adminId;
  const businessId = req.user!.businessId || senderId;

  if (!adminId) {
    return sendError(
      res,
      400,
      "MISSING_ADMIN_LINK",
      "Sender account must be linked to a parent admin account.",
    );
  }

  try {
    const result = await senderService.queueColdSend(senderId, adminId, businessId, req.body);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(
      res,
      err.statusCode || 500,
      err.code || "SEND_ERROR",
      err.message || "Failed to dispatch email campaign.",
    );
  }
});

export default router;
