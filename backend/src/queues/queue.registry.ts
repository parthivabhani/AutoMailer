/**
 * queue.registry.ts — Centralized BullMQ queue manager
 *
 * Single source of truth for all queue instances.
 * Queues are singletons — calling getQueue() multiple times
 * returns the same instance.
 *
 * Usage:
 *   import { getEmailQueue } from "@/queues/queue.registry";
 *   const queue = getEmailQueue();
 *   await queue.add("send", jobData, { priority: 5 });
 */

import { Queue, type QueueOptions } from "bullmq";
import { createBullMQConnection } from "../config/redis.js";
import { QUEUE_NAMES, JOB_RETRY } from "../config/constants.js";
import { logger } from "../shared/logger.js";

// ── Queue Singleton Registry ──────────────────────────────────────────────────

const _queues = new Map<string, Queue>();

function getQueue(name: string, options?: Partial<QueueOptions>): Queue {
  if (_queues.has(name)) {
    return _queues.get(name)!;
  }

  const connection = createBullMQConnection();
  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1_000, age: 24 * 3600 }, // Keep last 1k completed jobs for 24h
      removeOnFail: { count: 5_000, age: 7 * 24 * 3600 }, // Keep failed jobs for 7 days
    },
    ...options,
  });

  queue.on("error", (err) => {
    logger.error({ err, queue: name }, "BullMQ queue error");
  });

  _queues.set(name, queue);
  logger.info({ queue: name }, "BullMQ queue initialized");

  return queue;
}

// ── Named Queue Accessors ─────────────────────────────────────────────────────

export function getEmailQueue(): Queue {
  return getQueue(QUEUE_NAMES.EMAIL_SEND, {
    defaultJobOptions: {
      ...JOB_RETRY.EMAIL_SEND,
      removeOnComplete: { count: 2_000, age: 48 * 3600 },
      removeOnFail: { count: 10_000, age: 14 * 24 * 3600 },
    },
  });
}

export function getEmailScheduleQueue(): Queue {
  return getQueue(QUEUE_NAMES.EMAIL_SCHEDULE);
}

export function getEmailDeadLetterQueue(): Queue {
  return getQueue(QUEUE_NAMES.EMAIL_DEAD_LETTER, {
    defaultJobOptions: {
      removeOnFail: false, // Never auto-remove DLQ jobs
    },
  });
}

export function getAIQueue(): Queue {
  return getQueue(QUEUE_NAMES.AI_GENERATE, {
    defaultJobOptions: {
      ...JOB_RETRY.AI_GENERATE,
    },
  });
}

export function getAnalyticsQueue(): Queue {
  return getQueue(QUEUE_NAMES.ANALYTICS_AGGREGATE, {
    defaultJobOptions: {
      ...JOB_RETRY.ANALYTICS_AGGREGATE,
    },
  });
}

export function getBounceQueue(): Queue {
  return getQueue(QUEUE_NAMES.BOUNCE_PROCESS);
}

export function getWebhookQueue(): Queue {
  return getQueue(QUEUE_NAMES.WEBHOOK_PROCESS);
}

export function getSchedulerQueue(): Queue {
  return getQueue(QUEUE_NAMES.SCHEDULER);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function closeAllQueues(): Promise<void> {
  logger.info("Closing all BullMQ queues...");
  const closePromises = Array.from(_queues.values()).map((q) => q.close());
  await Promise.allSettled(closePromises);
  _queues.clear();
  logger.info("All BullMQ queues closed");
}

// ── Queue Health Check ────────────────────────────────────────────────────────

export async function getQueueHealthReport(): Promise<
  Record<
    string,
    {
      name: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    }
  >
> {
  const report: Record<string, any> = {};

  for (const [name, queue] of _queues.entries()) {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      report[name] = { name, waiting, active, completed, failed, delayed };
    } catch {
      report[name] = { name, error: "Failed to fetch counts" };
    }
  }

  return report;
}
