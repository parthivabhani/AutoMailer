import { Router, Response } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { supabase } from "../config/supabase.js";
import { sendEmailCampaign } from "../utils/email.js";

const router = Router();
router.use(requireAuth, requireRole(["sender", "admin"]));

// 1. GET /sender/assigned
router.get("/assigned", async (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.user!.id;
  try {
    // A. Fetch all assignments for this sender
    const { data: assignments, error: assignErr } = await supabase
      .from("csv_assignments")
      .select("*")
      .eq("sender_id", senderId);

    if (assignErr) return res.status(500).json({ error: assignErr.message });

    const csvIds = Array.from(new Set((assignments || []).map((a) => a.csv_id)));

    if (csvIds.length === 0) {
      return res.json([]);
    }

    // B. Fetch the CSV files assigned
    const { data: csvs, error: csvErr } = await supabase
      .from("csv_files")
      .select("*")
      .in("id", csvIds);

    if (csvErr) return res.status(500).json({ error: csvErr.message });

    // C. Format assigned CSV lists with segments
    const formattedCSVs = await Promise.all(
      (csvs || []).map(async (c) => {
        // Fetch only segments that are assigned to this sender for this CSV
        const assignedSegments = (assignments || [])
          .filter((a) => a.csv_id === c.id && a.segment_id !== null)
          .map((a) => a.segment_id);

        let segmentQuery = supabase.from("segments").select("*").eq("csv_id", c.id);
        if (assignedSegments.length > 0) {
          // If sender was assigned to specific segments, filter by those segments
          segmentQuery = segmentQuery.in("id", assignedSegments);
        }

        const { data: segments } = await segmentQuery;

        return {
          id: c.id,
          name: c.name,
          uploadedAt: c.uploaded_at,
          columns: c.columns,
          rows: c.rows,
          segments: (segments || []).map((s) => ({
            id: s.id,
            label: s.label,
            rowIds: s.row_ids
          })),
          assignedSenderIds: [senderId] // Kept for frontend representation compatibility
        };
      })
    );

    return res.json(formattedCSVs);
  } catch (err) {
    console.error("Error fetching sender assigned:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 2. POST /send
router.post("/send", async (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.user!.id;
  const adminId = req.user!.role === "admin" ? req.user!.id : req.user!.adminId; // Parent administrator or admin themselves
  const { csvId, segmentId, subject, body, recipientIds } = req.body;

  if (!adminId) {
    return res.status(400).json({ error: "Sender profile is missing linking to a parent admin account." });
  }

  if (!csvId || !subject || !body || !recipientIds || !Array.isArray(recipientIds)) {
    return res.status(400).json({ error: "Missing required fields: csvId, subject, body, recipientIds." });
  }

  try {
    const results = await sendEmailCampaign({
      senderId,
      adminId,
      csvId,
      segmentId,
      subjectTemplate: subject,
      bodyTemplate: body,
      recipientIds
    });

    return res.json(results);
  } catch (err: any) {
    console.error("Error dispatching email campaign:", err);
    return res.status(500).json({ error: err.message || "Failed to dispatch email campaign." });
  }
});

export default router;
