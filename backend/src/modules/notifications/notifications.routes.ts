/**
 * notifications.routes.ts — System notifications fetching
 */

import { Router, type Response } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getSupabase } from "../../config/supabase.js";
import { sendSuccess, sendError } from "../../shared/response.js";
import type { AuthenticatedRequest } from "../../shared/types.js";

const router = Router();
router.use(requireAuth);

// GET /api/v1/notifications — Fetch user notification history
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const businessId = req.user!.businessId || userId;

  try {
    const { data: logs, error } = await getSupabase()
      .from("audit_logs")
      .select("id, action, metadata, created_at")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .like("action", "notification.%")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const notifications = (logs || []).map((l) => ({
      id: l.id,
      type: l.action.replace("notification.", ""),
      title: l.metadata?.title || "Notification",
      message: l.metadata?.message || "",
      timestamp: l.created_at,
    }));

    return sendSuccess(res, notifications);
  } catch (err: any) {
    return sendError(res, 500, "FETCH_ERROR", "Failed to retrieve notifications history.");
  }
});

export default router;
