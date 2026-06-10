/**
 * analytics.worker.ts — Analytics aggregation worker
 *
 * Runs on a schedule to aggregate raw email_logs data into
 * pre-computed analytics_snapshots for fast dashboard queries.
 *
 * Schedules:
 *   - Hourly: aggregates last hour's email activity into daily snapshots
 *   - Daily: rolls up daily snapshots into weekly summaries
 *   - Monthly: rolls up weekly into monthly summaries
 */

import { Worker, type Job } from "bullmq";
import { createBullMQConnection } from "../config/redis.js";
import { QUEUE_NAMES } from "../config/constants.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import { workerLogger } from "../shared/logger.js";
import type { AnalyticsJobData } from "../shared/types.js";

// ── Aggregation Logic ─────────────────────────────────────────────────────────

async function aggregateDaily(businessId: string, date: string): Promise<void> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Aggregate email_logs for this business on this date
  let query = getSupabaseAdmin()
    .from("email_logs")
    .select("status, opened_at, clicked_at, replied_at, bounced_at")
    .gte("timestamp", startOfDay.toISOString())
    .lte("timestamp", endOfDay.toISOString());

  if (businessId !== "*") {
    query = query.eq("business_id", businessId);
  }

  const { data: logs, error } = await query;
  if (error) throw new Error(`Failed to fetch logs for aggregation: ${error.message}`);

  const emails = logs || [];
  const snapshot = {
    emails_sent: emails.filter((l) => l.status === "sent").length,
    emails_failed: emails.filter((l) => l.status === "failed").length,
    emails_opened: emails.filter((l) => l.opened_at).length,
    emails_clicked: emails.filter((l) => l.clicked_at).length,
    emails_replied: emails.filter((l) => l.replied_at).length,
    emails_bounced: emails.filter((l) => l.bounced_at).length,
  };

  // Aggregate AI usage for this day
  let aiQuery = getSupabaseAdmin()
    .from("ai_usage")
    .select("total_tokens, cost_usd")
    .gte("created_at", startOfDay.toISOString())
    .lte("created_at", endOfDay.toISOString());

  if (businessId !== "*") {
    aiQuery = aiQuery.eq("business_id", businessId);
  }

  const { data: aiLogs } = await aiQuery;
  const aiTokensUsed = (aiLogs || []).reduce((sum, r) => sum + (r.total_tokens || 0), 0);
  const aiCostUsd = (aiLogs || []).reduce((sum, r) => sum + (parseFloat(r.cost_usd) || 0), 0);

  // Count active senders (sent at least 1 email today)
  let senderQuery = getSupabaseAdmin()
    .from("email_logs")
    .select("sender_id")
    .eq("status", "sent")
    .gte("timestamp", startOfDay.toISOString())
    .lte("timestamp", endOfDay.toISOString());

  if (businessId !== "*") {
    senderQuery = senderQuery.eq("business_id", businessId);
  }

  const { data: senderLogs } = await senderQuery;
  const activeSenders = new Set((senderLogs || []).map((l) => l.sender_id)).size;

  // Upsert snapshot
  await getSupabaseAdmin()
    .from("analytics_snapshots")
    .upsert(
      {
        business_id: businessId === "*" ? null : businessId,
        snapshot_date: date,
        period: "daily",
        ...snapshot,
        ai_tokens_used: aiTokensUsed,
        ai_cost_usd: aiCostUsd.toFixed(4),
        active_senders: activeSenders,
      },
      { onConflict: "business_id, snapshot_date, period" },
    );

  workerLogger.debug({ businessId, date, snapshot }, "Daily analytics snapshot updated");
}

// ── Worker Processor ──────────────────────────────────────────────────────────

async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<void> {
  const { type, businessId, date } = job.data;

  workerLogger.info({ jobId: job.id, type, businessId, date }, "Processing analytics job");

  if (type === "hourly_rollup" || type === "daily_rollup") {
    const targetDate = date || new Date().toISOString().split("T")[0];

    if (businessId) {
      await aggregateDaily(businessId, targetDate);
    } else {
      // Aggregate ALL businesses (scheduled nightly run)
      const { data: businesses } = await getSupabaseAdmin()
        .from("businesses")
        .select("id")
        .eq("status", "active");

      const allBusinesses = businesses || [];
      await Promise.allSettled(allBusinesses.map((b) => aggregateDaily(b.id, targetDate)));

      workerLogger.info(
        { count: allBusinesses.length, date: targetDate },
        "Platform-wide analytics aggregation complete",
      );
    }
  }

  // TODO: Implement weekly and monthly rollups
  // if (type === "monthly_rollup") { ... }
}

// ── Worker Instance ───────────────────────────────────────────────────────────

let _analyticsWorker: Worker | null = null;

export function startAnalyticsWorker(): Worker {
  if (_analyticsWorker) return _analyticsWorker;

  _analyticsWorker = new Worker<AnalyticsJobData>(
    QUEUE_NAMES.ANALYTICS_AGGREGATE,
    processAnalyticsJob,
    {
      connection: createBullMQConnection(),
      concurrency: 1, // Singleton — prevents concurrent aggregations
    },
  );

  _analyticsWorker.on("completed", (job) => {
    workerLogger.info({ jobId: job.id }, "Analytics job completed");
  });

  _analyticsWorker.on("failed", (job, err) => {
    workerLogger.error({ jobId: job?.id, err: err.message }, "Analytics job failed");
  });

  workerLogger.info("Analytics worker started");
  return _analyticsWorker;
}

export async function stopAnalyticsWorker(): Promise<void> {
  if (_analyticsWorker) {
    await _analyticsWorker.close();
    _analyticsWorker = null;
  }
}
