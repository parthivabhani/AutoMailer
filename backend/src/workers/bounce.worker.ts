/**
 * bounce.worker.ts — Bounce processing worker
 *
 * Processes enqueued bounce and complaint events.
 * Updates email logs and inserts permanent blocks in contact_dedup
 * to protect domain SMTP sending reputation.
 */

import { Worker, type Job } from "bullmq";
import { createBullMQConnection } from "../config/redis.js";
import { QUEUE_NAMES } from "../config/constants.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import { workerLogger } from "../shared/logger.js";

interface BounceJobPayload {
  recipientEmail: string;
  bounceType: "permanent" | "transient" | "complaint";
  bouncedAt: string;
  reason?: string;
  messageId?: string;
}

async function processBounceJob(job: Job<BounceJobPayload>): Promise<void> {
  const { recipientEmail, bounceType, bouncedAt, reason } = job.data;

  workerLogger.warn(
    { jobId: job.id, recipientEmail, bounceType },
    "Processing bounce/complaint event",
  );

  const supabase = getSupabaseAdmin();

  // 1. If it's a permanent bounce or a complaint, block the email permanently
  if (bounceType === "permanent" || bounceType === "complaint") {
    // Look up the business associated with recent logs for this recipient to block them per-tenant
    const { data: recentLogs } = await supabase
      .from("email_logs")
      .select("business_id, sender_id")
      .eq("recipient_email", recipientEmail)
      .order("timestamp", { ascending: false })
      .limit(5);

    const businessIds = Array.from(
      new Set((recentLogs || []).map((l) => l.business_id).filter(Boolean)),
    );

    if (businessIds.length > 0) {
      workerLogger.info(
        { recipientEmail, businesses: businessIds },
        "Adding recipient to contact_dedup blocks",
      );

      // Add to contact_dedup with null cooldown_until (permanent block)
      await Promise.all(
        businessIds.map((bId) =>
          supabase.from("contact_dedup").upsert(
            {
              business_id: bId,
              recipient_email: recipientEmail,
              sent_at: new Date().toISOString(),
              cooldown_until: null, // Permanent block
            },
            { onConflict: "business_id, recipient_email" },
          ),
        ),
      );
    }
  }

  // 2. Mark bounced_at on email_logs for matching recipient
  const { error: logUpdateError } = await supabase
    .from("email_logs")
    .update({
      bounced_at: bouncedAt,
      error_message: reason ? `Bounce: ${reason}` : `Bounced (${bounceType})`,
    })
    .eq("recipient_email", recipientEmail)
    .is("bounced_at", null);

  if (logUpdateError) {
    workerLogger.error(
      { err: logUpdateError, recipientEmail },
      "Failed to update email logs for bounce",
    );
  }

  workerLogger.info({ recipientEmail }, "Bounce event processed successfully");
}

let _bounceWorker: Worker | null = null;

export function startBounceWorker(): Worker {
  if (_bounceWorker) return _bounceWorker;

  _bounceWorker = new Worker<BounceJobPayload>(QUEUE_NAMES.BOUNCE_PROCESS, processBounceJob, {
    connection: createBullMQConnection(),
    concurrency: 3,
  });

  _bounceWorker.on("completed", (job) => {
    workerLogger.debug({ jobId: job.id }, "Bounce worker job completed");
  });

  _bounceWorker.on("failed", (job, err) => {
    workerLogger.error({ jobId: job?.id, err: err.message }, "Bounce worker job failed");
  });

  workerLogger.info("Bounce worker started");
  return _bounceWorker;
}

export async function stopBounceWorker(): Promise<void> {
  if (_bounceWorker) {
    await _bounceWorker.close();
    _bounceWorker = null;
    workerLogger.info("Bounce worker stopped");
  }
}
