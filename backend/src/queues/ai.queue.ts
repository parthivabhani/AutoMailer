/**
 * ai.queue.ts — AI generation queue helper
 *
 * Provides typed helpers to enqueue asynchronous AI operations
 * (email generation, lead scoring, segmentation) to the BullMQ ai:generate queue.
 */

import { getAIQueue } from "./queue.registry.js";
import type { AIJobData } from "../shared/types.js";
import { logger } from "../shared/logger.js";

/**
 * Enqueues an AI task for background processing.
 *
 * @returns BullMQ Job ID
 */
export async function enqueueAITask(
  data: AIJobData,
  options: { delayMs?: number; priority?: number } = {}
): Promise<string> {
  const queue = getAIQueue();

  const jobId = `ai:${data.businessId}:${data.operation}:${Date.now()}`;
  const job = await queue.add(
    data.operation,
    data,
    {
      jobId,
      delay: options.delayMs || 0,
      priority: options.priority || 0,
      removeOnComplete: { age: 24 * 3600 },
    }
  );

  logger.debug(
    { jobId: job.id, operation: data.operation, businessId: data.businessId },
    "AI background task enqueued"
  );

  return job.id!;
}
