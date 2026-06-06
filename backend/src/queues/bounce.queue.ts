/**
 * bounce.queue.ts — Bounce processing queue helper
 *
 * Enqueues bounce or complaint event payloads received from mail servers
 * or webhooks for background parsing and reputation protection.
 */

import { getBounceQueue } from "./queue.registry.js";
import { logger } from "../shared/logger.js";

interface BounceJobPayload {
  recipientEmail: string;
  bounceType: "permanent" | "transient" | "complaint";
  bouncedAt: string;
  reason?: string;
  messageId?: string;
}

/**
 * Enqueues a bounce event for background processing.
 */
export async function enqueueBounceEvent(
  payload: BounceJobPayload
): Promise<string> {
  const queue = getBounceQueue();
  const jobId = `bounce:${payload.recipientEmail}:${Date.now()}`;

  const job = await queue.add(
    "process_bounce",
    payload,
    {
      jobId,
      removeOnComplete: { age: 7 * 24 * 3600 },
    }
  );

  logger.warn(
    { jobId: job.id, recipientEmail: payload.recipientEmail, type: payload.bounceType },
    "Bounce event queued for processing"
  );

  return job.id!;
}
