/**
 * analytics.queue.ts — Analytics queue helper
 *
 * Provides typed helper to enqueue hourly/daily/monthly rollups to the analytics queue.
 */

import { getAnalyticsQueue } from "./queue.registry.js";
import type { AnalyticsJobData } from "../shared/types.js";
import { logger } from "../shared/logger.js";

/**
 * Enqueues an analytics rollup task.
 */
export async function enqueueAnalyticsRollup(
  data: AnalyticsJobData
): Promise<string> {
  const queue = getAnalyticsQueue();
  const jobId = `analytics:${data.type}:${data.businessId || "all"}:${data.date}`;
  
  const job = await queue.add(
    data.type,
    data,
    {
      jobId,
      removeOnComplete: { age: 7 * 24 * 3600 },
    }
  );

  logger.debug({ jobId: job.id, type: data.type }, "Analytics rollup enqueued");
  return job.id!;
}
