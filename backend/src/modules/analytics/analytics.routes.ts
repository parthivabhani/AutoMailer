/**
 * analytics.routes.ts — Charts-ready analytics endpoints
 *
 * Returns pre-aggregated data from analytics_snapshots for fast dashboards.
 * No expensive GROUP BY on hot paths — all data is pre-computed by workers.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate, DateRangeSchema } from "../../middleware/requestValidator.js";
import type { AuthenticatedRequest } from "../../shared/types.js";
import { sendSuccess, sendError } from "../../shared/response.js";
import { getSupabase } from "../../config/supabase.js";

const router = Router();
router.use(requireAuth);

// ── GET /analytics/overview — Dashboard summary ───────────────────────────────

router.get(
  "/overview",
  requireRole(["admin"]),
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;
    const { days } = req.query as any;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    try {
      // Fetch pre-aggregated snapshots
      const { data: snapshots, error } = await getSupabase()
        .from("analytics_snapshots")
        .select("*")
        .eq("business_id", businessId)
        .eq("period", "daily")
        .gte("snapshot_date", fromDate.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true });

      if (error) throw error;

      const rows = snapshots || [];

      // Roll up totals
      const totals = rows.reduce(
        (acc, s) => ({
          emailsSent: acc.emailsSent + (s.emails_sent || 0),
          emailsFailed: acc.emailsFailed + (s.emails_failed || 0),
          emailsOpened: acc.emailsOpened + (s.emails_opened || 0),
          emailsClicked: acc.emailsClicked + (s.emails_clicked || 0),
          emailsReplied: acc.emailsReplied + (s.emails_replied || 0),
          emailsBounced: acc.emailsBounced + (s.emails_bounced || 0),
          aiTokensUsed: acc.aiTokensUsed + (s.ai_tokens_used || 0),
          aiCostUsd: acc.aiCostUsd + parseFloat(s.ai_cost_usd || "0"),
        }),
        {
          emailsSent: 0, emailsFailed: 0, emailsOpened: 0,
          emailsClicked: 0, emailsReplied: 0, emailsBounced: 0,
          aiTokensUsed: 0, aiCostUsd: 0,
        }
      );

      const deliveryRate = totals.emailsSent + totals.emailsFailed > 0
        ? Math.round((totals.emailsSent / (totals.emailsSent + totals.emailsFailed)) * 100)
        : 100;

      const openRate = totals.emailsSent > 0
        ? Math.round((totals.emailsOpened / totals.emailsSent) * 100)
        : 0;

      // Format time series for charts
      const timeSeries = rows.map((s) => ({
        date: s.snapshot_date,
        sent: s.emails_sent,
        failed: s.emails_failed,
        opened: s.emails_opened,
        clicked: s.emails_clicked,
      }));

      return sendSuccess(res, {
        period: { days, from: fromDate.toISOString().split("T")[0] },
        totals,
        rates: { deliveryRate, openRate },
        timeSeries,
      });
    } catch (err) {
      return sendError(res, 500, "ANALYTICS_ERROR", "Failed to fetch analytics overview");
    }
  }
);

// ── GET /analytics/senders — Per-sender productivity breakdown ────────────────

router.get(
  "/senders",
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;

    try {
      // Get sender IDs under this admin
      const { data: senders } = await getSupabase()
        .from("profiles")
        .select("id, name, email")
        .eq("admin_id", adminId)
        .eq("role", "sender");

      const senderIds = (senders || []).map((s) => s.id);
      if (senderIds.length === 0) return sendSuccess(res, []);

      // Get email stats per sender
      const senderStats = await Promise.all(
        (senders || []).map(async (sender) => {
          const [sentResult, failedResult, skippedResult] = await Promise.all([
            getSupabase()
              .from("email_logs")
              .select("*", { count: "exact", head: true })
              .eq("sender_id", sender.id)
              .eq("status", "sent"),
            getSupabase()
              .from("email_logs")
              .select("*", { count: "exact", head: true })
              .eq("sender_id", sender.id)
              .eq("status", "failed"),
            getSupabase()
              .from("email_logs")
              .select("*", { count: "exact", head: true })
              .eq("sender_id", sender.id)
              .eq("status", "skipped_duplicate"),
          ]);

          const sent = sentResult.count || 0;
          const failed = failedResult.count || 0;
          const skipped = skippedResult.count || 0;
          const successRate = sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : 100;

          return {
            id: sender.id,
            name: sender.name,
            email: sender.email,
            emailsSent: sent,
            emailsFailed: failed,
            emailsSkipped: skipped,
            successRate,
          };
        })
      );

      return sendSuccess(res, senderStats);
    } catch (err) {
      return sendError(res, 500, "ANALYTICS_ERROR", "Failed to fetch sender analytics");
    }
  }
);

// ── GET /analytics/ai-usage — AI token usage breakdown ───────────────────────

router.get(
  "/ai-usage",
  requireRole(["admin"]),
  validate({ query: DateRangeSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;

    try {
      let query = getSupabase()
        .from("ai_usage")
        .select("provider, model, operation, total_tokens, cost_usd, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (req.query.from) query = query.gte("created_at", req.query.from as string);
      if (req.query.to) query = query.lte("created_at", req.query.to as string);

      const { data, error } = await query;
      if (error) throw error;

      // Group by provider
      const byProvider = (data || []).reduce(
        (acc, r) => {
          const key = r.provider;
          if (!acc[key]) acc[key] = { tokens: 0, costUsd: 0, requests: 0 };
          acc[key].tokens += r.total_tokens || 0;
          acc[key].costUsd += parseFloat(r.cost_usd || "0");
          acc[key].requests += 1;
          return acc;
        },
        {} as Record<string, { tokens: number; costUsd: number; requests: number }>
      );

      const totalTokens = Object.values(byProvider).reduce((s, p) => s + p.tokens, 0);
      const totalCostUsd = Object.values(byProvider).reduce((s, p) => s + p.costUsd, 0);

      return sendSuccess(res, {
        totalTokens,
        totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
        byProvider,
        records: data,
      });
    } catch (err) {
      return sendError(res, 500, "ANALYTICS_ERROR", "Failed to fetch AI usage analytics");
    }
  }
);

export default router;
