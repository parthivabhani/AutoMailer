/**
 * worker.bootstrap.ts — Worker startup orchestrator
 *
 * Single entry point to start all background workers.
 * Can be run as a separate process from the API server
 * for horizontal scaling, or embedded in the same process
 * for simple single-server deployments.
 *
 * Usage (separate process):
 *   npx tsx src/workers/worker.bootstrap.ts
 *
 * Usage (embedded — current setup):
 *   Called from app.ts on startup when FEATURE_REDIS_ENABLED=true
 */

import { startEmailWorker, stopEmailWorker } from "./email.worker.js";
import { startAnalyticsWorker, stopAnalyticsWorker } from "./analytics.worker.js";
import { startSchedulerWorker, stopSchedulerWorker } from "./scheduler.worker.js";
import { startAIWorker, stopAIWorker } from "./ai.worker.js";
import { startBounceWorker, stopBounceWorker } from "./bounce.worker.js";
import { workerLogger } from "../shared/logger.js";
import { getEnv } from "../config/env.js";

// ── Worker Registry ───────────────────────────────────────────────────────────

interface WorkerHandle {
  name: string;
  stop: () => Promise<void>;
}

const _activeWorkers: WorkerHandle[] = [];

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export function startAllWorkers(): void {
  const env = getEnv();

  if (!env.FEATURE_REDIS_ENABLED) {
    workerLogger.warn(
      "FEATURE_REDIS_ENABLED=false — Workers are disabled. " +
        "Email sending will fall back to synchronous mode. " +
        "This is NOT recommended for production.",
    );
    return;
  }

  workerLogger.info("Starting background workers...");

  try {
    startEmailWorker();
    _activeWorkers.push({ name: "email", stop: stopEmailWorker });

    startAnalyticsWorker();
    _activeWorkers.push({ name: "analytics", stop: stopAnalyticsWorker });

    startSchedulerWorker();
    _activeWorkers.push({ name: "scheduler", stop: stopSchedulerWorker });

    startAIWorker();
    _activeWorkers.push({ name: "ai", stop: stopAIWorker });

    startBounceWorker();
    _activeWorkers.push({ name: "bounce", stop: stopBounceWorker });

    workerLogger.info(
      { workers: _activeWorkers.map((w) => w.name) },
      `✅ ${_activeWorkers.length} workers started`,
    );
  } catch (err) {
    workerLogger.error({ err }, "Failed to start workers");
    throw err;
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

export async function stopAllWorkers(): Promise<void> {
  workerLogger.info("Stopping all workers...");

  const stopPromises = _activeWorkers.map(async (worker) => {
    try {
      await worker.stop();
      workerLogger.info({ worker: worker.name }, "Worker stopped");
    } catch (err) {
      workerLogger.error({ worker: worker.name, err }, "Worker failed to stop cleanly");
    }
  });

  await Promise.allSettled(stopPromises);
  _activeWorkers.length = 0;

  workerLogger.info("All workers stopped");
}

// ── Standalone Mode ───────────────────────────────────────────────────────────
// When this file is run directly as a process (not imported), start workers
// and handle graceful shutdown signals.

const isMain =
  process.argv[1]?.endsWith("worker.bootstrap.ts") ||
  process.argv[1]?.endsWith("worker.bootstrap.js");

if (isMain) {
  // Load environment first
  import("dotenv")
    .then(({ default: dotenv }) => {
      dotenv.config();
      return import("../config/env.js");
    })
    .then(({ loadEnv }) => {
      loadEnv();
      startAllWorkers();
      workerLogger.info("Worker process running in standalone mode");
    })
    .catch((err) => {
      console.error("Failed to start worker process:", err);
      process.exit(1);
    });

  // Graceful shutdown on SIGTERM (Kubernetes, Docker stop)
  process.on("SIGTERM", async () => {
    workerLogger.info("SIGTERM received — shutting down workers");
    await stopAllWorkers();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    workerLogger.info("SIGINT received — shutting down workers");
    await stopAllWorkers();
    process.exit(0);
  });
}
