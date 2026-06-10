/**
 * contacts.routes.ts — CSV and contact management endpoints
 */

import { Router, type Response } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/requestValidator.js";
import { UploadCsvSchema, AssignCsvSchema } from "./contacts.schema.js";
import { contactsService } from "./contacts.service.js";
import { sendSuccess, sendCreated, sendError } from "../../shared/response.js";
import type { AuthenticatedRequest } from "../../shared/types.js";

const router = Router();
router.use(requireAuth, requireRole(["admin"]));

// GET /admin/csv — List all lists with segments and assignments
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;

  try {
    const csvs = await contactsService.getCsvFiles(adminId);
    return sendSuccess(res, csvs);
  } catch (err: any) {
    return sendError(res, 500, "FETCH_ERROR", err.message || "Failed to list CSV sheets.");
  }
});

// POST /admin/csv — Upload a new cold contact list
router.post("/", validate(UploadCsvSchema), async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;
  const businessId = req.user!.businessId || adminId;
  const { name, columns, rows } = req.body;

  try {
    const csv = await contactsService.uploadCsv(adminId, businessId, name, columns, rows);
    return sendCreated(res, csv);
  } catch (err: any) {
    return sendError(res, 500, "UPLOAD_ERROR", err.message || "Failed to process contact list.");
  }
});

// POST /admin/csv/:id/segment — Trigger AI contact list segmentation
router.post("/:id/segment", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;
  const businessId = req.user!.businessId || adminId;
  const { id } = req.params;

  try {
    const segments = await contactsService.segmentCsv(adminId, businessId, adminId, id);
    return sendSuccess(res, segments);
  } catch (err: any) {
    return sendError(res, 500, "SEGMENT_ERROR", err.message || "Failed to segment contact list.");
  }
});

// POST /admin/csv/:id/assign — Assign CSV/segment to a sender
router.post(
  "/:id/assign",
  validate(AssignCsvSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const { senderId, segmentId } = req.body;

    try {
      const result = await contactsService.assignCsv(adminId, id, senderId, segmentId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(
        res,
        err.statusCode || 500,
        err.code || "ASSIGN_ERROR",
        err.message || "Failed to assign CSV list.",
      );
    }
  },
);

export default router;
