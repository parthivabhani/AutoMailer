/**
 * billing.routes.ts — Subscription and usage billing endpoints
 *
 * Feature-flagged behind FEATURE_BILLING_ENABLED.
 * Stubs ready for Stripe integration.
 *
 * TODO: Install stripe package: npm install stripe
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { audit } from "../../middleware/auditLog.js";
import type { AuthenticatedRequest } from "../../shared/types.js";
import { sendSuccess, sendError } from "../../shared/response.js";
import { getSupabase, getSupabaseAdmin } from "../../config/supabase.js";
import { getEnv } from "../../config/env.js";
import { logger } from "../../shared/logger.js";

const router = Router();

// ── Billing Feature Flag Guard ────────────────────────────────────────────────

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!getEnv().FEATURE_BILLING_ENABLED) {
    res.status(503).json({
      success: false,
      error: {
        code: "FEATURE_DISABLED",
        message: "Billing features are not enabled on this instance.",
      },
    });
    return;
  }
  next();
});

router.use(requireAuth);

// ── GET /billing/subscription — Current plan details ─────────────────────────

router.get(
  "/subscription",
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;

    try {
      const { data, error } = await getSupabase()
        .from("subscriptions")
        .select("*")
        .eq("business_id", businessId)
        .single();

      if (error || !data) {
        // Return free tier defaults if no subscription record
        return sendSuccess(res, {
          plan: "free",
          status: "active",
          emailsUsed: 0,
          emailsLimit: 500,
          aiTokensUsed: 0,
          aiTokensLimit: 10_000,
        });
      }

      return sendSuccess(res, {
        id: data.id,
        plan: data.plan,
        status: data.status,
        currentPeriodEnd: data.current_period_end,
        emailsUsed: data.emails_used,
        emailsLimit: data.emails_limit,
        aiTokensUsed: data.ai_tokens_used,
        aiTokensLimit: data.ai_tokens_limit,
      });
    } catch (err) {
      return sendError(res, 500, "BILLING_ERROR", "Failed to fetch subscription");
    }
  },
);

// ── GET /billing/history — Invoice history ────────────────────────────────────

router.get("/history", requireRole(["admin"]), async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.userId;
  const businessId = req.user!.businessId || adminId;

  try {
    const { data, error } = await getSupabase()
      .from("billing_history")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return sendSuccess(res, data || []);
  } catch (err) {
    return sendError(res, 500, "BILLING_ERROR", "Failed to fetch billing history");
  }
});

// ── POST /billing/create-checkout — Create Stripe checkout session ────────────

router.post(
  "/create-checkout",
  requireRole(["admin"]),
  audit("billing.checkout_created"),
  async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const businessId = req.user!.businessId || adminId;
    const { priceId, returnUrl } = req.body;

    if (!priceId) {
      return sendError(res, 400, "MISSING_PRICE_ID", "priceId is required");
    }

    try {
      // TODO: Initialize Stripe and create checkout session
      // const stripe = new Stripe(getEnv().STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20" });
      // const session = await stripe.checkout.sessions.create({...});

      // Stub response
      logger.info({ adminId, businessId, priceId }, "Billing checkout initiated (stub)");

      return sendSuccess(res, {
        checkoutUrl: `https://checkout.stripe.com/stub?price=${priceId}`,
        sessionId: "stub_session_id",
        // TODO: Return real session URL
      });
    } catch (err) {
      return sendError(res, 500, "STRIPE_ERROR", "Failed to create checkout session");
    }
  },
);

// ── POST /billing/webhook — Stripe webhook handler ────────────────────────────

router.post("/webhook", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;
  const env = getEnv();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  try {
    // TODO: Verify Stripe signature and process event
    // const stripe = new Stripe(env.STRIPE_SECRET_KEY!);
    // const event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    // switch (event.type) {
    //   case "invoice.payment_succeeded": await handlePaymentSucceeded(event); break;
    //   case "customer.subscription.deleted": await handleSubscriptionCancelled(event); break;
    // }

    logger.info({ signature: signature?.slice(0, 20) }, "Stripe webhook received (stub)");

    return res.json({ received: true });
  } catch (err: any) {
    logger.error({ err }, "Stripe webhook failed");
    return res.status(400).json({ error: err.message });
  }
});

// ── Super-Admin: Platform Revenue Metrics ─────────────────────────────────────

router.get(
  "/platform/revenue",
  requireRole(["super_admin"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { data: history } = await getSupabaseAdmin()
        .from("billing_history")
        .select("amount_cents, currency, status, created_at")
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1000);

      const records = history || [];
      const totalRevenueCents = records.reduce((s, r) => s + (r.amount_cents || 0), 0);

      const { count: activeSubscriptions } = await getSupabaseAdmin()
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .neq("plan", "free");

      return sendSuccess(res, {
        totalRevenueCents,
        totalRevenueUsd: (totalRevenueCents / 100).toFixed(2),
        activeSubscriptions: activeSubscriptions || 0,
        recentInvoices: records.slice(0, 10),
      });
    } catch (err) {
      return sendError(res, 500, "BILLING_ERROR", "Failed to fetch revenue metrics");
    }
  },
);

export default router;
