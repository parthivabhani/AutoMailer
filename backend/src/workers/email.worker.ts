/**
 * email.worker.ts — BullMQ email sending worker
 *
 * The heart of the async email dispatch system.
 * Extracted from the synchronous utils/email.ts and reimplemented
 * as a proper async worker that:
 *
 * - Pulls jobs from the email:send queue
 * - Checks deduplication via contact_dedup table
 * - Fetches SMTP config and decrypts credentials
 * - Performs variable interpolation
 * - Sends email via Nodemailer
 * - Logs results to email_logs
 * - Updates campaign_jobs status
 * - Handles failures with structured logging
 * - Moves failed jobs to dead-letter queue after max retries
 */

import { Worker, type Job, UnrecoverableError } from "bullmq";
import nodemailer, { type Transporter } from "nodemailer";
import { createBullMQConnection } from "../config/redis.js";
import { QUEUE_NAMES, EMAIL_CONFIG } from "../config/constants.js";
import { getSupabase, getSupabaseAdmin } from "../config/supabase.js";
import { decrypt } from "../shared/crypto.js";
import { workerLogger } from "../shared/logger.js";
import { getEmailDeadLetterQueue } from "../queues/queue.registry.js";
import type { EmailJobData } from "../shared/types.js";

// ── SMTP Transporter Cache ────────────────────────────────────────────────────
// Cache transporters per admin to avoid recreating on every email

const _transporterCache = new Map<string, { transporter: Transporter; expiresAt: number }>();
const TRANSPORTER_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

async function getTransporter(adminId: string): Promise<Transporter> {
  const cached = _transporterCache.get(adminId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.transporter;
  }

  // Fetch SMTP config
  const { data: smtpConfig, error } = await getSupabase()
    .from("smtp_configs")
    .select("*")
    .eq("admin_id", adminId)
    .single();

  if (error || !smtpConfig) {
    // This is unrecoverable — no point retrying without SMTP config
    throw new UnrecoverableError(`No SMTP configuration found for admin ${adminId}`);
  }

  let password: string;
  try {
    password = decrypt(smtpConfig.encrypted_password);
  } catch {
    throw new UnrecoverableError(`Failed to decrypt SMTP credentials for admin ${adminId}`);
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpConfig.gmail,
      pass: password,
    },
  });

  _transporterCache.set(adminId, {
    transporter,
    expiresAt: Date.now() + TRANSPORTER_CACHE_TTL_MS,
  });

  return transporter;
}

// ── Deduplication Check ───────────────────────────────────────────────────────

async function isRecipientDuplicate(
  businessId: string,
  recipientEmail: string,
  senderOverride: boolean,
): Promise<boolean> {
  if (senderOverride) {
    return false; // Admin explicitly allowed re-sending
  }

  const { data, error } = await getSupabase()
    .from("contact_dedup")
    .select("id, cooldown_until")
    .eq("business_id", businessId)
    .eq("recipient_email", recipientEmail)
    .limit(1);

  if (error || !data || data.length === 0) return false;

  const record = data[0];
  // If cooldown_until is null → permanent dedup
  // If cooldown_until is in the future → still in cooldown
  if (!record.cooldown_until || new Date(record.cooldown_until) > new Date()) {
    return true;
  }

  return false;
}

// ── Variable Interpolation ────────────────────────────────────────────────────

function interpolate(template: string, data: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{${key}\\}`, "gi");
    result = result.replace(regex, String(value ?? ""));
  }
  return result;
}

// ── Main Worker Processor ─────────────────────────────────────────────────────

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const {
    businessId,
    campaignId,
    campaignJobId,
    senderId,
    adminId,
    recipientEmail,
    recipientData,
    subjectTemplate,
    bodyTemplate,
    senderOverride,
    delayMs,
  } = job.data;

  workerLogger.info(
    { jobId: job.id, recipientEmail, campaignId, attempt: job.attemptsMade },
    "Processing email job",
  );

  // 1. Natural delay to mimic human pacing (only on first attempt)
  if (job.attemptsMade === 0 && delayMs && delayMs > 0) {
    await new Promise((r) => setTimeout(r, delayMs));
  }

  // 2. Check deduplication
  const isDuplicate = await isRecipientDuplicate(businessId, recipientEmail, senderOverride);

  if (isDuplicate) {
    await logEmailResult({
      businessId,
      campaignId,
      campaignJobId,
      senderId,
      recipientEmail,
      recipientName: recipientData.name || recipientData.Name || "Recipient",
      subject: subjectTemplate,
      body: bodyTemplate,
      status: "skipped_duplicate",
      errorMessage: "Recipient already contacted — within deduplication cooldown.",
    });

    if (campaignJobId) {
      await updateCampaignJobStatus(campaignJobId, "skipped");
    }

    workerLogger.debug({ jobId: job.id, recipientEmail }, "Email skipped (duplicate)");
    return; // Job "completed" successfully — it was intentionally skipped
  }

  // 3. Get SMTP transporter
  const transporter = await getTransporter(adminId);

  // 4. Interpolate templates
  const subject = interpolate(subjectTemplate, recipientData);
  const body = interpolate(bodyTemplate, recipientData);

  // 5. Get sender's display name for From header
  const { data: smtpConfig } = await getSupabase()
    .from("smtp_configs")
    .select("gmail")
    .eq("admin_id", adminId)
    .single();

  const fromAddress = smtpConfig?.gmail || "noreply@automailer.com";

  try {
    // 6. Send email
    await transporter.sendMail({
      from: `"${fromAddress}" <${fromAddress}>`,
      to: recipientEmail,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>"), // Basic HTML conversion
    });

    // 7. Log success
    await logEmailResult({
      businessId,
      campaignId,
      campaignJobId,
      senderId,
      recipientEmail,
      recipientName: recipientData.name || recipientData.Name || "Recipient",
      subject,
      body,
      status: "sent",
    });

    // 8. Record in deduplication table
    await getSupabaseAdmin()
      .from("contact_dedup")
      .upsert(
        {
          business_id: businessId,
          campaign_id: campaignId || null,
          recipient_email: recipientEmail,
          sender_id: senderId,
          sent_at: new Date().toISOString(),
          cooldown_until: null, // Permanent dedup — admin must use sender_override to resend
        },
        { onConflict: "business_id, recipient_email" },
      );

    // 9. Update campaign job status
    if (campaignJobId) {
      await updateCampaignJobStatus(campaignJobId, "sent");
    }

    workerLogger.info({ jobId: job.id, recipientEmail }, "Email sent successfully");
  } catch (sendErr: any) {
    workerLogger.error(
      { jobId: job.id, err: sendErr, recipientEmail, attempt: job.attemptsMade },
      "Email send failed",
    );

    // Log the failure
    await logEmailResult({
      businessId,
      campaignId,
      campaignJobId,
      senderId,
      recipientEmail,
      recipientName: recipientData.name || "Recipient",
      subject,
      body,
      status: "failed",
      errorMessage: sendErr.message,
    });

    if (campaignJobId) {
      await updateCampaignJobStatus(campaignJobId, "failed", sendErr.message);
    }

    throw sendErr; // Re-throw for BullMQ retry logic
  }
}

// ── Database Helpers ──────────────────────────────────────────────────────────

async function logEmailResult(data: {
  businessId: string;
  campaignId?: string;
  campaignJobId?: string;
  senderId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  status: "sent" | "failed" | "skipped_duplicate" | "skipped_policy";
  errorMessage?: string;
}) {
  await getSupabaseAdmin()
    .from("email_logs")
    .insert({
      business_id: data.businessId,
      campaign_id: data.campaignId || null,
      campaign_job_id: data.campaignJobId || null,
      sender_id: data.senderId,
      recipient_email: data.recipientEmail,
      recipient_name: data.recipientName,
      subject: data.subject,
      body: data.body,
      status: data.status,
      error_message: data.errorMessage || null,
    });
}

async function updateCampaignJobStatus(
  jobId: string,
  status: "sent" | "failed" | "skipped" | "processing",
  errorMessage?: string,
) {
  await getSupabaseAdmin()
    .from("campaign_jobs")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error_message: errorMessage || null,
    })
    .eq("id", jobId);
}

// ── Worker Instance ───────────────────────────────────────────────────────────

let _emailWorker: Worker | null = null;

export function startEmailWorker(): Worker {
  if (_emailWorker) return _emailWorker;

  _emailWorker = new Worker<EmailJobData>(QUEUE_NAMES.EMAIL_SEND, processEmailJob, {
    connection: createBullMQConnection(),
    concurrency: 5, // Process up to 5 emails simultaneously per worker
    limiter: {
      max: 10, // Max 10 jobs processed
      duration: 1000, // Per second (10/s global rate limit on this worker)
    },
  });

  _emailWorker.on("completed", (job) => {
    workerLogger.debug({ jobId: job.id }, "Email job completed");
  });

  _emailWorker.on("failed", async (job, err) => {
    workerLogger.error({ jobId: job?.id, err: err.message }, "Email job permanently failed");

    // Move to dead-letter queue after max retries exhausted
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      try {
        await getEmailDeadLetterQueue().add(
          "dead-letter",
          { originalJob: job.data, failReason: err.message, failedAt: new Date().toISOString() },
          { jobId: `dlq:${job.id}` },
        );
      } catch (dlqErr) {
        workerLogger.error({ dlqErr }, "Failed to move job to DLQ");
      }
    }
  });

  _emailWorker.on("error", (err) => {
    workerLogger.error({ err }, "Email worker error");
  });

  workerLogger.info("Email worker started");
  return _emailWorker;
}

export async function stopEmailWorker(): Promise<void> {
  if (_emailWorker) {
    await _emailWorker.close();
    _emailWorker = null;
    workerLogger.info("Email worker stopped");
  }
}
