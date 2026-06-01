/**
 * logger.ts — Structured logging via pino
 *
 * Provides structured JSON logging in production and pretty-printed
 * logs in development. All log entries include timestamp, level,
 * and optional context (requestId, userId, businessId).
 *
 * Usage:
 *   import { logger } from "@/shared/logger";
 *   logger.info({ userId, action: "login" }, "User logged in");
 *   logger.error({ err, requestId }, "Request failed");
 */

import pino, { type Logger } from "pino";

// ── Log Level ─────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== "production";

// ── Pino Transport ────────────────────────────────────────────────────────────

const transport = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    }
  : undefined;

// ── Logger Instance ───────────────────────────────────────────────────────────

export const logger: Logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
    base: {
      env: process.env.NODE_ENV || "development",
      service: "automailer-api",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    redact: {
      // Never log sensitive fields
      paths: [
        "req.headers.authorization",
        "*.password",
        "*.encrypted_password",
        "*.stripe_secret*",
        "*.apiKey",
      ],
      censor: "[REDACTED]",
    },
  },
  transport ? pino.transport(transport) : undefined
);

// ── Child Logger Factory ──────────────────────────────────────────────────────

/**
 * Creates a child logger with bound context fields.
 * Use this in request handlers to automatically include
 * requestId, userId, businessId in every log line.
 */
export function createChildLogger(context: {
  requestId?: string;
  userId?: string;
  businessId?: string;
  module?: string;
}) {
  return logger.child(context);
}

// ── Audit-specific Logger ─────────────────────────────────────────────────────

export const auditLogger = logger.child({ type: "audit" });

// ── Queue/Worker Logger ───────────────────────────────────────────────────────

export const workerLogger = logger.child({ type: "worker" });

export default logger;
