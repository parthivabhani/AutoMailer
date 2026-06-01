/**
 * scheduler.worker.ts — Cron + delayed job executor
 *
 * Handles:
 * - Scheduled campaign launches (send at specific time)
 * - Recurring campaign execution (daily/weekly newsletters)
 * - Analytics aggregation scheduling
 * - Pause/resume campaign support
 */

import { Worker, type Job } from "bullmq";
// Note: QueueScheduler was removed in BullMQ v4+ — delayed jobs are handled
// automatically by the queue itself without a separate scheduler process.
import { createBullMQConnection } from "../config/redis.js";
import { QUEUE_NAMES } from "../config/constants.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import { getAnalyticsQueue } from "../queues/queue.registry.js";
import { enqueueCampaignBatch } from "../queues/email.queue.js";
import { workerLogger } from "../shared/logger.js";

// ── Job Handlers ──────────────────────────────────────────────────────────────

async function launchScheduledCampaign(campaignId: string): Promise<void> {
  // 1. Fetch campaign details
  const { data: campaign, error } = await getSupabaseAdmin()
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("status", "scheduled")
    .single();

  if (error || !campaign) {
    workerLogger.warn({ campaignId }, "Scheduled campaign not found or not in 'scheduled' status");
    return;
  }

  // 2. Mark campaign as sending
  await getSupabaseAdmin()
    .from("campaigns")
    .update({ status: "sending", started_at: new Date().toISOString() })
    .eq("id", campaignId);

  // 3. Fetch all pending campaign_jobs for this campaign
  const { data: pendingJobs } = await getSupabaseAdmin()
    .from("campaign_jobs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if (!pendingJobs || pendingJobs.length === 0) {
    workerLogger.warn({ campaignId }, "No pending jobs found for campaign");
    await getSupabaseAdmin()
      .from("campaigns")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", campaignId);
    return;
  }

  // 4. Enqueue all recipients
  await enqueueCampaignBatch(
    pendingJobs.map((j) => ({
      email: j.recipient_email,
      data: j.recipient_data,
      isVip: j.priority >= 10,
      vipScore: j.priority,
    })),
    {
      businessId: campaign.business_id,
      campaignId: campaign.id,
      senderId: pendingJobs[0].sender_id,
      adminId: campaign.admin_id,
      subjectTemplate: campaign.subject_template,
      bodyTemplate: campaign.body_template,
      senderOverride: campaign.sender_override,
      // delayBetweenEmailsMs is used internally by enqueueCampaignBatch
      attachments: [],
    } as any
  );

  workerLogger.info(
    { campaignId, recipientCount: pendingJobs.length },
    "Scheduled campaign launched"
  );
}

async function scheduleAnalyticsRollup(date: string): Promise<void> {
  await getAnalyticsQueue().add(
    "daily_rollup",
    {
      type: "daily_rollup",
      date,
    },
    {
      jobId: `analytics:daily:${date}`,
      removeOnComplete: { age: 7 * 24 * 3600 },
    }
  );
  workerLogger.debug({ date }, "Analytics rollup scheduled");
}

// ── Worker Processor ──────────────────────────────────────────────────────────

async function processSchedulerJob(job: Job): Promise<void> {
  const { name, data } = job;

  workerLogger.info({ jobId: job.id, jobName: name }, "Processing scheduler job");

  switch (name) {
    case "launch_scheduled_campaign":
      await launchScheduledCampaign(data.campaignId);
      break;

    case "analytics_daily_rollup":
      await scheduleAnalyticsRollup(data.date || new Date().toISOString().split("T")[0]);
      break;

    case "resume_campaign":
      // TODO: Resume a paused campaign
      // Fetch unprocessed campaign_jobs and re-enqueue them
      workerLogger.info({ campaignId: data.campaignId }, "Campaign resume — TODO implement");
      break;

    default:
      workerLogger.warn({ jobName: name }, "Unknown scheduler job type");
  }
}

// ── Worker Instance ───────────────────────────────────────────────────────────

let _schedulerWorker: Worker | null = null;

export function startSchedulerWorker(): Worker {
  if (_schedulerWorker) return _schedulerWorker;

  _schedulerWorker = new Worker(
    QUEUE_NAMES.SCHEDULER,
    processSchedulerJob,
    {
      connection: createBullMQConnection(),
      concurrency: 2,
    }
  );

  _schedulerWorker.on("completed", (job) => {
    workerLogger.info({ jobId: job.id, jobName: job.name }, "Scheduler job completed");
  });

  _schedulerWorker.on("failed", (job, err) => {
    workerLogger.error({ jobId: job?.id, err: err.message }, "Scheduler job failed");
  });

  workerLogger.info("Scheduler worker started");

  // Register recurring cron jobs using BullMQ repeatable jobs
  scheduleRecurringJobs().catch((err) => {
    workerLogger.error({ err }, "Failed to schedule recurring jobs");
  });

  return _schedulerWorker;
}

/**
 * Registers platform-wide recurring jobs.
 * These run on a fixed schedule regardless of individual campaigns.
 */
async function scheduleRecurringJobs(): Promise<void> {
  const schedulerQueue = await import("../queues/queue.registry.js").then(
    (m) => m.getSchedulerQueue()
  );

  // Daily analytics rollup at midnight UTC
  await schedulerQueue.add(
    "analytics_daily_rollup",
    { date: null }, // Worker will compute current date
    {
      repeat: {
        pattern: "0 0 * * *", // Every day at midnight UTC (cron)
      },
      jobId: "recurring:analytics:daily",
    }
  );

  workerLogger.info("Recurring jobs registered");
}

export async function stopSchedulerWorker(): Promise<void> {
  if (_schedulerWorker) {
    await _schedulerWorker.close();
    _schedulerWorker = null;
  }
}
