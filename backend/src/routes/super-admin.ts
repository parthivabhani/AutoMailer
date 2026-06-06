import { Router, Response } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { supabase } from "../config/supabase.js";

const router = Router();

// Apply auth middleware to all Super Admin endpoints
router.use(requireAuth, requireRole(["super_admin"]));

// 1. GET /super-admin/admins
router.get("/admins", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: admins, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Map DB fields to camelCase structure expected by frontend
    const formattedAdmins = (admins || []).map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      status: a.status || "active",
      smtpConfigured: a.smtp_configured,
      createdAt: a.created_at
    }));

    return res.json(formattedAdmins);
  } catch (err) {
    console.error("Error in listAdmins:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 2. PATCH /super-admin/admins/:id/status
router.patch("/admins/:id/status", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // 'active' | 'suspended'

  if (!status || !["active", "suspended"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      id: updatedProfile.id,
      name: updatedProfile.name,
      email: updatedProfile.email,
      role: updatedProfile.role,
      status: updatedProfile.status,
      smtpConfigured: updatedProfile.smtp_configured,
      createdAt: updatedProfile.created_at
    });
  } catch (err) {
    console.error("Error in setAdminStatus:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 3. GET /super-admin/stats
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Total admins count
    const { count: totalAdmins, error: adminErr } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    // 2. Total email logs count (total sent platform-wide)
    const { count: totalSent, error: sentErr } = await supabase
      .from("email_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent");

    const { count: totalFailed, error: failErr } = await supabase
      .from("email_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed");

    const { count: totalSkipped, error: skipErr } = await supabase
      .from("email_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "skipped_duplicate");

    if (adminErr || sentErr || failErr || skipErr) {
      return res.status(500).json({ error: "Error aggregating metrics." });
    }

    // 3. Return platform-wide stats object expected by frontend
    return res.json({
      totalAdmins: totalAdmins || 0,
      emailsSent: totalSent || 0,
      emailsFailed: totalFailed || 0,
      emailsSkipped: totalSkipped || 0,
      // Provide simple mock dashboard charts that adapt to real volumes
      monthlyVolume: [
        { name: "Jan", sent: Math.round((totalSent || 0) * 0.15), failed: Math.round((totalFailed || 0) * 0.15) },
        { name: "Feb", sent: Math.round((totalSent || 0) * 0.20), failed: Math.round((totalFailed || 0) * 0.20) },
        { name: "Mar", sent: Math.round((totalSent || 0) * 0.25), failed: Math.round((totalFailed || 0) * 0.25) },
        { name: "Apr", sent: Math.round((totalSent || 0) * 0.40), failed: Math.round((totalFailed || 0) * 0.40) }
      ]
    });
  } catch (err) {
    console.error("Error in super-admin stats:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
