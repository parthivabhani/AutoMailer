/**
 * templates.routes.ts — Reusable email template management
 *
 * Senders and admins can create, save, share, and reuse email templates.
 * Templates support the same {variable} interpolation as campaigns.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate, UUIDSchema, PaginationSchema } from "../../middleware/requestValidator.js";
import { audit } from "../../middleware/auditLog.js";
import type { AuthenticatedRequest } from "../../shared/types.js";
import { sendSuccess, sendCreated, sendError, sendNotFound } from "../../shared/response.js";
import { getSupabase } from "../../config/supabase.js";

const router = Router();
router.use(requireAuth, requireRole(["admin", "sender"]));

// ── Helper: Extract interpolation variables ───────────────────────────────────

function extractVariables(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateTemplateSchema = {
  body: z.object({
    name: z.string().min(1).max(255),
    subject: z.string().min(1).max(500),
    body: z.string().min(1).max(50_000),
    isShared: z.boolean().default(false),
  }),
};

// ── GET /templates — List templates ──────────────────────────────────────────

router.get("/", validate({ query: PaginationSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const businessId = req.user!.businessId || userId;
  const { page = 1, limit = 20 } = req.query as any;

  try {
    const result = await templatesService.getTemplates(businessId, userId, Number(page), Number(limit));
    return sendSuccess(res, result.data, 200, {
      page: Number(page),
      limit: Number(limit),
      total: result.count,
      hasMore: result.hasMore,
    });
  } catch (err) {
    return sendError(res, 500, "FETCH_ERROR", "Failed to fetch templates");
  }
});

// ── POST /templates — Create a template ──────────────────────────────────────

router.post(
  "/",
  validate(CreateTemplateSchema),
  audit("template.created"),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const businessId = req.user!.businessId || userId;

    try {
      const data = await templatesService.createTemplate(businessId, userId, req.body);
      return sendCreated(res, data);
    } catch (err) {
      return sendError(res, 500, "CREATE_ERROR", "Failed to create template");
    }
  }
);

// ── GET /templates/:id ────────────────────────────────────────────────────────

router.get("/:id", validate({ params: z.object({ id: UUIDSchema }) }), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const businessId = req.user!.businessId || userId;
  const role = req.user!.role;

  try {
    const data = await templatesService.getTemplate(businessId, userId, role, req.params.id);
    return sendSuccess(res, data);
  } catch (err: any) {
    return sendError(
      res,
      err.statusCode || 500,
      err.code || "FETCH_ERROR",
      err.message || "Failed to fetch template"
    );
  }
});

// ── PATCH /templates/:id ──────────────────────────────────────────────────────

router.patch(
  "/:id",
  validate({ params: z.object({ id: UUIDSchema }), body: CreateTemplateSchema.body.partial() }),
  audit("template.updated"),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const businessId = req.user!.businessId || userId;
    const role = req.user!.role;

    try {
      const data = await templatesService.updateTemplate(businessId, userId, role, req.params.id, req.body);
      return sendSuccess(res, data);
    } catch (err: any) {
      return sendError(
        res,
        err.statusCode || 500,
        err.code || "UPDATE_ERROR",
        err.message || "Failed to update template"
      );
    }
  }
);

// ── DELETE /templates/:id ─────────────────────────────────────────────────────

router.delete(
  "/:id",
  audit("template.deleted"),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const businessId = req.user!.businessId || userId;
    const role = req.user!.role;

    try {
      const result = await templatesService.deleteTemplate(businessId, userId, role, req.params.id);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(
        res,
        err.statusCode || 500,
        err.code || "DELETE_ERROR",
        err.message || "Failed to delete template"
      );
    }
  }
);

import { templatesService } from "./templates.service.js";

export default router;
