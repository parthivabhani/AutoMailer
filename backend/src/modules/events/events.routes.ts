/**
 * events.routes.ts — Realtime event streaming (Server-Sent Events)
 *
 * Exposes SSE streams for dashboard updates (e.g. queue statuses).
 */

import { Router, type Response } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getQueueHealthReport } from "../../queues/queue.registry.js";
import { getEnv } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import type { AuthenticatedRequest } from "../../shared/types.js";

const router = Router();

// GET /api/v1/events/queue-status — SSE stream for diagnostics dashboard
router.get(
  "/queue-status",
  requireAuth,
  requireRole(["admin", "super_admin"]),
  (req: AuthenticatedRequest, res: Response) => {
    const env = getEnv();

    if (!env.FEATURE_REDIS_ENABLED) {
      res.status(503).json({
        success: false,
        error: { code: "REDIS_DISABLED", message: "Redis queue monitoring is disabled." },
      });
      return;
    }

    // Configure headers for persistent SSE stream connection
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    logger.debug({ userId: req.user?.userId }, "Client connected to Queue Status SSE stream");

    const sendStatus = async () => {
      try {
        const status = await getQueueHealthReport();
        res.write(`data: ${JSON.stringify(status)}\n\n`);
      } catch (err) {
        logger.warn({ err }, "Failed to stream queue status to SSE client");
      }
    };

    // Push initial diagnostics report
    void sendStatus();

    // Stream updates every 5 seconds
    const intervalId = setInterval(() => void sendStatus(), 5000);

    req.on("close", () => {
      clearInterval(intervalId);
      logger.debug(
        { userId: req.user?.userId },
        "Client disconnected from Queue Status SSE stream",
      );
    });
  },
);

export default router;
