/**
 * app.ts — Express application factory
 *
 * Creates and configures the Express application.
 * Separated from index.ts to allow testing without starting the server.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { getEnv } from "./config/env.js";
import { isAppError } from "./shared/errors.js";
import { logger } from "./shared/logger.js";
import { globalRateLimiter } from "./middleware/rateLimiter.js";
import { API_PREFIX } from "./config/constants.js";

// ── Route Imports ─────────────────────────────────────────────────────────────

// Refactored modular routes (backward compatible URL contracts preserved)
import authRouter from "./modules/auth/auth.routes.js";
import superAdminRouter from "./modules/super-admin/super-admin.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";
import senderRouter from "./modules/sender/sender.routes.js";

// New modular routes
import aiRoutesNew from "./ai/ai.routes.js";
import campaignRouter from "./modules/campaigns/campaign.routes.js";
import templatesRouter from "./modules/templates/templates.routes.js";
import analyticsRouter from "./modules/analytics/analytics.routes.js";
import billingRouter from "./modules/billing/billing.routes.js";
import notificationsRouter from "./modules/notifications/notifications.routes.js";
import eventsRouter from "./modules/events/events.routes.js";

// ── App Factory ───────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();
  const env = getEnv();

  // ── Security Headers (Helmet) ───────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for API (no HTML)
      crossOriginEmbedderPolicy: false,
    })
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, Postman)
        if (!origin) { callback(null, true); return; }
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
          callback(null, true); return;
        }
        callback(new Error(`CORS: Origin '${origin}' not allowed`));
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
      credentials: true,
    })
  );

  // ── Body Parsing ────────────────────────────────────────────────────────────
  // Raw body for Stripe webhooks (must be before JSON middleware for that route)
  app.use("/billing/webhook", express.raw({ type: "application/json" }));

  app.use(express.json({ limit: "10mb" })); // Reduced from 50mb — CSVs should be parsed before
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ── Request ID ──────────────────────────────────────────────────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers["x-request-id"] as string || crypto.randomUUID();
    res.setHeader("x-request-id", requestId);
    (req as any).requestId = requestId;
    next();
  });

  // ── Global Rate Limiting ────────────────────────────────────────────────────
  app.use(globalRateLimiter);

  // ── Health Check ─────────────────────────────────────────────────────────────
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "healthy",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: env.NODE_ENV,
    });
  });

  // ── Queue Status (monitoring endpoint) ────────────────────────────────────────
  app.get("/health/queues", async (req: Request, res: Response): Promise<void> => {
    try {
      if (!env.FEATURE_REDIS_ENABLED) {
        res.json({ status: "disabled", message: "Redis/queues are disabled" });
        return;
      }
      const { getQueueHealthReport } = await import("./queues/queue.registry.js");
      const report = await getQueueHealthReport();
      res.json({ status: "healthy", queues: report });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Could not fetch queue status" });
    }
  });

  // ── Legacy API Routes (Backward Compatible) ────────────────────────────────
  // These preserve the existing URL contracts so the frontend continues to work.
  app.use("/auth", authRouter);
  app.use("/super-admin", superAdminRouter);
  app.use("/admin", adminRouter);
  app.use("/sender", senderRouter);
  app.use("/ai", aiRoutesNew); // Replaced with enhanced version

  // ── New Versioned API Routes ───────────────────────────────────────────────
  app.use(`${API_PREFIX}/campaigns`, campaignRouter);
  app.use(`${API_PREFIX}/templates`, templatesRouter);
  app.use(`${API_PREFIX}/analytics`, analyticsRouter);
  app.use(`${API_PREFIX}/billing`, billingRouter);
  app.use(`${API_PREFIX}/notifications`, notificationsRouter);
  app.use(`${API_PREFIX}/events`, eventsRouter);

  // ── 404 Handler ────────────────────────────────────────────────────────────
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Cannot ${req.method} ${req.url}`,
      },
    });
  });

  // ── Global Error Handler ───────────────────────────────────────────────────
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(err)) {
      // Operational errors — known, expected
      logger.warn(
        { err, path: req.path, method: req.method, requestId: (req as any).requestId },
        `Operational error: ${err.code}`
      );

      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined && { details: err.details }),
        },
      });
    }

    // Programmer errors — unexpected
    logger.error(
      { err, path: req.path, method: req.method, requestId: (req as any).requestId },
      "Unhandled error"
    );

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          process.env.NODE_ENV === "development"
            ? (err as any)?.message || "Unexpected error"
            : "An unexpected error occurred. Please try again.",
      },
    });
  });

  return app;
}
