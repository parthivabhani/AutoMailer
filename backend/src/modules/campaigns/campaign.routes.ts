/**
 * campaign.routes.ts — Campaign management endpoints
 *
 * New endpoints for the full campaign lifecycle:
 * Create → Schedule → Launch → Pause → Resume → Complete
 *
 * Includes: scheduled sending, sender override, VIP prioritization
 */

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate, UUIDSchema, PaginationSchema } from "../../middleware/requestValidator.js";
import { audit } from "../../middleware/auditLog.js";
import { campaignSendRateLimiter } from "../../middleware/rateLimiter.js";
import type { AuthenticatedRequest } from "../../shared/types.js";
import { sendSuccess, sendCreated, sendError, sendNotFound } from "../../shared/response.js";
import { getSupabase, getSupabaseAdmin } from "../../config/supabase.js";
import { enqueueCampaignBatch, scheduleEmailCampaign } from "../../queues/email.queue.js";
import { aiRouter } from "../../ai/ai.router.js";
import { logger } from "../../shared/logger.js";
import { CAMPAIGN_STATUS } from "../../config/constants.js";
import { campaignService } from "./campaign.service.js";
import { campaignRepository } from "./campaign.repository.js";

const router = Router();
router.use(requireAuth, requireRole(["admin", "sender"]));

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateCampaignSchema = {
  body: z.object({
    name: z.string().min(1).max(255),
    subjectTemplate: z.string().min(1).max(500),
    bodyTemplate: z.string().min(1).max(50_000),
    scheduledAt: z.string().datetime().optional(),
    timezone: z.string().default("UTC"),
    delayBetweenEmailsMs: z.number().int().min(200).max(30_000).default(300),
    senderOverride: z.boolean().default(false),
    batchSize: z.number().int().min(1).max(500).default(50),
    priority: z.number().int().min(0).max(10).default(0),
  }),
};

const LaunchCampaignSchema = {
  body: z.object({
    recipientIds: z.array(z.string()).min(1).max(5_000),
    csvId: z.string().uuid(),
    segmentId: z.string().uuid().optional(),
    senderId: z.string().uuid().optional(), // Admin can override sender
  }),
};

const UpdateCampaignSchema = {
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    subjectTemplate: z.string().min(1).max(500).optional(),
    bodyTemplate: z.string().min(1).max(50_000).optional(),
    scheduledAt: z.string().datetime().optional().nullable(),
    senderOverride: z.boolean().optional(),
  }),
};

// ── GET /campaigns ────────────────────────────────────────────────────────────

router.get(
  "/",
  validate({ query: PaginationSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const { page = 1, limit = 20 } = req.query as any;

    try {
      const result = await campaignService.getCampaigns(adminId, Number(page), Number(limit));
      return sendSuccess(res, result.data, 200, {
        page: Number(page),
        limit: Number(limit),
        total: result.count,
        hasMore: result.hasMore,
      });
    } catch (err: any) {
      logger.error({ err }, "Failed to fetch campaigns");
      return sendError(res, 500, "FETCH_ERROR", "Failed to fetch campaigns");
    }
  },
);

// ── POST /campaigns — Create a new campaign ───────────────────────────────────

router.post(
  "/",
  requirePermission("campaigns:create"),
  validate(CreateCampaignSchema),
  audit("campaign.created"),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;

    try {
      const campaign = await campaignService.createCampaign(adminId, businessId, req.body);
      return sendCreated(res, campaign);
    } catch (err: any) {
      logger.error({ err }, "Failed to create campaign");
      return sendError(
        res,
        err.statusCode || 500,
        err.code || "CREATE_ERROR",
        err.message || "Failed to create campaign",
      );
    }
  },
);

// ── GET /campaigns/:id — Get campaign details ─────────────────────────────────

router.get(
  "/:id",
  validate({ params: z.object({ id: UUIDSchema }) }),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;

    try {
      const campaign = await getSupabase()
        .from("campaigns")
        .select("*, campaign_jobs(count)")
        .eq("id", req.params.id)
        .eq("business_id", businessId)
        .single();

      if (campaign.error || !campaign.data) return sendNotFound(res, "Campaign");

      return sendSuccess(res, campaign.data);
    } catch (err) {
      logger.error({ err }, "Failed to fetch campaign");
      return sendError(res, 500, "FETCH_ERROR", "Failed to fetch campaign");
    }
  },
);

// ── PATCH /campaigns/:id — Update a draft campaign ───────────────────────────

router.patch(
  "/:id",
  requirePermission("campaigns:update"),
  validate({ params: z.object({ id: UUIDSchema }), ...UpdateCampaignSchema }),
  audit("campaign.updated"),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;

    try {
      const updated = await campaignService.updateCampaign(adminId, req.params.id, {
        ...req.body,
        businessId,
      });
      return sendSuccess(res, updated);
    } catch (err: any) {
      logger.error({ err }, "Failed to update campaign");
      return sendError(
        res,
        err.statusCode || 500,
        err.code || "UPDATE_ERROR",
        err.message || "Failed to update campaign",
      );
    }
  },
);

// ── POST /campaigns/:id/launch — Immediately launch a campaign ────────────────

router.post(
  "/:id/launch",
  requirePermission("campaigns:launch"),
  campaignSendRateLimiter,
  validate({ params: z.object({ id: UUIDSchema }), ...LaunchCampaignSchema }),
  audit("campaign.launched"),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;

    try {
      const result = await campaignService.launchCampaign(
        adminId,
        businessId,
        req.params.id,
        req.body,
      );
      return sendSuccess(res, {
        campaignId: result.campaignId,
        status: result.status,
        recipientsQueued: result.recipientsQueued,
        message: `Campaign launched. ${result.recipientsQueued} emails queued for delivery.`,
      });
    } catch (err: any) {
      logger.error({ err }, "Failed to launch campaign");
      return sendError(
        res,
        err.statusCode || 500,
        err.code || "LAUNCH_ERROR",
        err.message || "Failed to launch campaign",
      );
    }
  },
);

// ── POST /campaigns/:id/pause ─────────────────────────────────────────────────

router.post(
  "/:id/pause",
  requirePermission("campaigns:pause"),
  audit("campaign.paused"),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;

    try {
      const result = await campaignService.pauseCampaign(adminId, businessId, req.params.id);
      return sendSuccess(res, result);
    } catch (err: any) {
      logger.error({ err }, "Failed to pause campaign");
      return sendError(
        res,
        err.statusCode || 500,
        err.code || "PAUSE_ERROR",
        err.message || "Failed to pause campaign",
      );
    }
  },
);

// ── GET /campaigns/:id/progress — Live progress for dashboard ─────────────────

router.get("/:id/progress", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;
  const businessId = req.user!.businessId || adminId;

  try {
    const { data, error } = await getSupabase()
      .from("campaign_jobs")
      .select("status")
      .eq("campaign_id", req.params.id)
      .eq("business_id", businessId);

    if (error) throw error;

    const jobs = data || [];
    const counts = jobs.reduce(
      (acc, j) => {
        acc[j.status] = (acc[j.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return sendSuccess(res, {
      total: jobs.length,
      sent: counts["sent"] || 0,
      failed: counts["failed"] || 0,
      skipped: counts["skipped"] || 0,
      pending: counts["pending"] || 0,
      processing: counts["processing"] || 0,
    });
  } catch (err) {
    return sendError(res, 500, "PROGRESS_ERROR", "Failed to fetch campaign progress");
  }
});

export default router;
