/**
 * index.ts — Application entry point with graceful shutdown
 *
 * Replaces the original index.ts with:
 * - Environment validation on startup
 * - Graceful SIGTERM/SIGINT handling
 * - Worker bootstrap (when Redis is enabled)
 * - Clean error reporting on startup failure
 */

import dotenv from "dotenv";
dotenv.config();

import { loadEnv } from "./config/env.js";
import { logger } from "./shared/logger.js";
import { createApp } from "./app.js";
import { startAllWorkers, stopAllWorkers } from "./workers/worker.bootstrap.js";
import { closeAllQueues } from "./queues/queue.registry.js";
import { closeRedisConnection } from "./config/redis.js";

// ── Step 1: Validate Environment ──────────────────────────────────────────────
const env = loadEnv();

// ── Step 2: Create Express App ────────────────────────────────────────────────
const app = createApp();

// ── Step 3: Start Server ──────────────────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
      redisEnabled: env.FEATURE_REDIS_ENABLED,
      aiProvider: env.AI_DEFAULT_PROVIDER,
    },
    `
╔══════════════════════════════════════════╗
║      AutoMailer Pro — API v2.0.0         ║
║  Enterprise SaaS Backend Online          ║
╠══════════════════════════════════════════╣
║  Port    : ${String(env.PORT).padEnd(30)}║
║  Env     : ${env.NODE_ENV.padEnd(30)}║
║  Redis   : ${(env.FEATURE_REDIS_ENABLED ? "Enabled" : "Disabled").padEnd(30)}║
║  AI      : ${env.AI_DEFAULT_PROVIDER.padEnd(30)}║
║  Billing : ${(env.FEATURE_BILLING_ENABLED ? "Enabled" : "Disabled").padEnd(30)}║
╚══════════════════════════════════════════╝`
  );
});

// ── Step 4: Start Background Workers ─────────────────────────────────────────
if (env.FEATURE_REDIS_ENABLED) {
  try {
    startAllWorkers();
  } catch (err) {
    logger.error({ err }, "Failed to start workers. API will run without queue support.");
    // Don't crash the API server if workers fail to start
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Shutdown signal received — starting graceful shutdown");

  // 1. Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed — no new requests accepted");

    try {
      // 2. Stop workers (drain current jobs)
      await stopAllWorkers();

      // 3. Close BullMQ queues
      await closeAllQueues();

      // 4. Close Redis connection
      await closeRedisConnection();

      logger.info("✅ Graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  });

  // Force exit after 30s if graceful shutdown hangs
  setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 30_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled Promise Rejection");
  // Don't crash in production — log and continue
  if (env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught Exception — shutting down");
  gracefulShutdown("uncaughtException");
});

export default app;
