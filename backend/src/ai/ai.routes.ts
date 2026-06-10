/**
 * ai.routes.ts — Refactored AI endpoints
 *
 * Migrates the existing routes/ai.ts to use the new AIRouter abstraction.
 * Adds per-tenant rate limiting and request validation.
 *
 * All existing endpoints are preserved and backward-compatible.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/requestValidator.js";
import { aiRouter } from "./ai.router.js";
import type { AuthenticatedRequest } from "../shared/types.js";
import { sendSuccess, sendError } from "../shared/response.js";
import { logger } from "../shared/logger.js";

const router = Router();
router.use(requireAuth);
router.use(aiRateLimiter);

// ── Validation Schemas ────────────────────────────────────────────────────────

const GenerateSchema = {
  body: z.object({
    brief: z.string().min(5, "Brief must be at least 5 characters").max(500),
    recipient: z.record(z.any()),
  }),
};

const HumanizeSchema = {
  body: z.object({
    body: z.string().min(10, "Email body must be at least 10 characters").max(5000),
  }),
};

const SubjectsSchema = {
  body: z.object({
    body: z.string().min(10).max(5000),
    count: z.number().int().min(1).max(10).optional().default(5),
  }),
};

// ── POST /ai/generate ─────────────────────────────────────────────────────────

router.post(
  "/generate",
  validate(GenerateSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { brief, recipient } = req.body;

    try {
      const result = await aiRouter.generateEmail({
        brief,
        recipient,
        businessId: req.user!.businessId || req.user!.userId,
        userId: req.user!.userId,
      });

      // Return just the content string for backward compatibility
      return sendSuccess(res, result.content);
    } catch (err: any) {
      logger.error({ err, userId: req.user?.userId }, "AI generate failed");
      return sendError(res, 500, "AI_ERROR", "Failed to generate email. Please try again.");
    }
  },
);

// ── POST /ai/humanize ─────────────────────────────────────────────────────────

router.post(
  "/humanize",
  validate(HumanizeSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { body } = req.body;

    try {
      const result = await aiRouter.humanizeEmail({
        body,
        businessId: req.user!.businessId || req.user!.userId,
        userId: req.user!.userId,
      });

      return sendSuccess(res, result.content);
    } catch (err: any) {
      logger.error({ err }, "AI humanize failed");
      return sendError(res, 500, "AI_ERROR", "Failed to humanize email. Please try again.");
    }
  },
);

// ── POST /ai/subjects ─────────────────────────────────────────────────────────

router.post(
  "/subjects",
  validate(SubjectsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { body, count } = req.body;

    try {
      const result = await aiRouter.generateSubjects({
        body,
        count,
        businessId: req.user!.businessId || req.user!.userId,
        userId: req.user!.userId,
      });

      return sendSuccess(res, result.content);
    } catch (err: any) {
      logger.error({ err }, "AI subjects failed");
      return sendError(res, 500, "AI_ERROR", "Failed to generate subjects. Please try again.");
    }
  },
);

export default router;
