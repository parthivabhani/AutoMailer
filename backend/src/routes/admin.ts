import { Router, Response } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { supabase, supabaseAdmin } from "../config/supabase.js";
import { encrypt } from "../utils/crypto.js";
import Groq from "groq-sdk";

const router = Router();
router.use(requireAuth, requireRole(["admin"]));

// 1. GET /admin/stats
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  try {
    // A. Count active senders linked to this admin
    const { count: sendersCount, error: senderErr } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("admin_id", adminId)
      .eq("role", "sender");

    // B. Count uploaded CSV lists
    const { count: csvCount, error: csvErr } = await supabase
      .from("csv_files")
      .select("*", { count: "exact", head: true })
      .eq("admin_id", adminId);

    // C. Aggregate email log volumes sent by senders under this admin
    // Get sender IDs first
    const { data: senders } = await supabase
      .from("profiles")
      .select("id")
      .eq("admin_id", adminId)
      .eq("role", "sender");

    const senderIds = (senders || []).map((s) => s.id);

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    if (senderIds.length > 0) {
      const { count: sent } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .in("sender_id", senderIds)
        .eq("status", "sent");

      const { count: fail } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .in("sender_id", senderIds)
        .eq("status", "failed");

      const { count: skip } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .in("sender_id", senderIds)
        .eq("status", "skipped_duplicate");

      totalSent = sent || 0;
      totalFailed = fail || 0;
      totalSkipped = skip || 0;
    }

    return res.json({
      activeSenders: sendersCount || 0,
      listsUploaded: csvCount || 0,
      emailsSent: totalSent,
      emailsFailed: totalFailed,
      emailsSkipped: totalSkipped,
      deliverySuccessRate: totalSent + totalFailed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 100,
      monthlyVolume: [
        { name: "Week 1", sent: Math.round(totalSent * 0.2), failed: Math.round(totalFailed * 0.2) },
        { name: "Week 2", sent: Math.round(totalSent * 0.25), failed: Math.round(totalFailed * 0.25) },
        { name: "Week 3", sent: Math.round(totalSent * 0.25), failed: Math.round(totalFailed * 0.25) },
        { name: "Week 4", sent: Math.round(totalSent * 0.3), failed: Math.round(totalFailed * 0.3) }
      ]
    });
  } catch (err) {
    console.error("Error in admin stats:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 2. GET /admin/senders
router.get("/senders", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  try {
    const { data: senders, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("admin_id", adminId)
      .eq("role", "sender");

    if (error) return res.status(500).json({ error: error.message });

    // Map database sender profiles, aggregating emails sent per sender
    const formattedSenders = await Promise.all(
      (senders || []).map(async (s) => {
        const { count: emailCount } = await supabase
          .from("email_logs")
          .select("*", { count: "exact", head: true })
          .eq("sender_id", s.id)
          .eq("status", "sent");

        // Get assigned lists names
        const { data: assignments } = await supabase
          .from("csv_assignments")
          .select("csv_id")
          .eq("sender_id", s.id);

        const csvIds = (assignments || []).map((a) => a.csv_id);

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          assignedCsvIds: csvIds,
          emailsSent: emailCount || 0,
          createdAt: s.created_at
        };
      })
    );

    return res.json(formattedSenders);
  } catch (err) {
    console.error("Error listing senders:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 3. POST /admin/senders
router.post("/senders", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields: name, email, password." });
  }

  try {
    let newUserId: string;

    // Use service role if available, else standard backend signup fallback
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: "sender" }
      });

      if (authErr || !authUser.user) {
        return res.status(400).json({ error: authErr?.message || "Failed to create authentication account." });
      }
      newUserId = authUser.user.id;
    } else {
      // Standard client signup called from server (does not disrupt active admin frontend session)
      const { data: authUser, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role: "sender" }
        }
      });

      if (authErr || !authUser.user) {
        return res.status(400).json({ error: authErr?.message || "Failed to sign up sender." });
      }
      newUserId = authUser.user.id;
    }

    // Explicitly insert the created profile linked to this admin
    const { data: insertedProfile, error: profileErr } = await supabase
      .from("profiles")
      .insert({
        id: newUserId,
        name,
        email,
        role: "sender",
        admin_id: adminId
      })
      .select()
      .single();

    if (profileErr) {
      return res.status(500).json({ error: `Sender auth created, but profile insertion failed: ${profileErr.message}` });
    }

    const finalProfile = insertedProfile;

    return res.status(201).json({
      id: finalProfile.id,
      name: finalProfile.name,
      email: finalProfile.email,
      assignedCsvIds: [],
      emailsSent: 0,
      createdAt: finalProfile.created_at
    });
  } catch (err) {
    console.error("Error creating sender:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 4. DELETE /admin/senders/:id
router.delete("/senders/:id", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const adminId = req.user!.id;

  try {
    // 1. Verify this sender belongs to this admin
    const { data: sender, error: fetchErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .eq("admin_id", adminId)
      .single();

    if (fetchErr || !sender) {
      return res.status(404).json({ error: "Sender not found or unauthorized." });
    }

    // 2. Delete Auth account if service role is active
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }

    // 3. Delete profile from database (cascade deletes assignments)
    const { error: deleteErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (deleteErr) return res.status(500).json({ error: deleteErr.message });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting sender:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 5. GET /admin/csv
router.get("/csv", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  try {
    const { data: csvs, error } = await supabase
      .from("csv_files")
      .select("*")
      .eq("admin_id", adminId)
      .order("uploaded_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Format for frontend
    const formattedCSVs = await Promise.all(
      (csvs || []).map(async (c) => {
        const { data: segments } = await supabase
          .from("segments")
          .select("*")
          .eq("csv_id", c.id);

        const { data: assignments } = await supabase
          .from("csv_assignments")
          .select("sender_id")
          .eq("csv_id", c.id);

        const assignedSenderIds = Array.from(new Set((assignments || []).map((a) => a.sender_id)));

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
          assignedSenderIds
        };
      })
    );

    return res.json(formattedCSVs);
  } catch (err) {
    console.error("Error listing CSVs:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 6. POST /admin/csv
router.post("/csv", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { name, columns, rows } = req.body;

  if (!name || !columns || !rows) {
    return res.status(400).json({ error: "Missing required fields: name, columns, rows." });
  }

  try {
    const { data: csv, error } = await supabase
      .from("csv_files")
      .insert({
        admin_id: adminId,
        name,
        columns,
        rows
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({
      id: csv.id,
      name: csv.name,
      uploadedAt: csv.uploaded_at,
      columns: csv.columns,
      rows: csv.rows,
      segments: [],
      assignedSenderIds: []
    });
  } catch (err) {
    console.error("Error uploading CSV:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 7. POST /admin/csv/:id/segment
router.post("/csv/:id/segment", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const adminId = req.user!.id;

  try {
    // 1. Get CSV data
    const { data: csv, error: fetchErr } = await supabase
      .from("csv_files")
      .select("*")
      .eq("id", id)
      .eq("admin_id", adminId)
      .single();

    if (fetchErr || !csv) {
      return res.status(404).json({ error: "CSV not found or unauthorized." });
    }

    const rows = csv.rows as Array<any>;
    const cols = csv.columns as string[];

    if (rows.length === 0) {
      return res.status(400).json({ error: "CSV list is empty." });
    }

    // 2. Perform segmentation using Groq Llama-3 AI or fallback smart heuristics
    const groqKey = process.env.GROQ_API_KEY;
    let segments: Array<{ label: string; rowIds: string[] }> = [];

    if (groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        
        // Take a small subset of rows (up to 15) to help Groq design optimal segment groups
        const sampleRows = rows.slice(0, 15).map(r => {
          const simplified: any = {};
          cols.forEach(c => {
            if (/company|industry|role|title|segment|category/i.test(c)) {
              simplified[c] = r[c];
            }
          });
          // Fallback to first few columns if no specific matching found
          if (Object.keys(simplified).length === 0) {
            cols.slice(0, 3).forEach(c => simplified[c] = r[c]);
          }
          simplified._id = r._id;
          return simplified;
        });

        const prompt = `You are a data intelligence engine. I have a list of sales/marketing lead contacts. Here is a sample of the data (each row has an '_id' field):
${JSON.stringify(sampleRows, null, 2)}

Your task is to analyze these leads and create exactly 3 distinct, high-converting target segments/clusters (e.g. "Tech Startups", "Healthcare Enterprises", "Marketing Agencies", or based on business titles like "Software Executives", "Marketing Directors") depending on the data provided.

Output your response as a valid JSON array of objects, where each object has:
1. "label": string (the name of the target segment)
2. "criteria": string (1-sentence describing the criteria for this segment)

Respond ONLY with the raw JSON array. Do not include markdown blocks, notes, or chat. Make it a strict JSON format.`;

        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.1-8b-instant",
          temperature: 0.1,
          response_format: { type: "json_object" }
        });

        const content = chatCompletion.choices[0]?.message?.content || "";
        const parsed = JSON.parse(content);
        const inferredSegments = parsed.segments || parsed.clusters || parsed;

        if (Array.isArray(inferredSegments)) {
          // Heuristical classification: map each row to one of the inferred labels
          const labels: string[] = inferredSegments.map((s: any) => s.label);
          const groups = new Map<string, string[]>();
          labels.forEach(l => groups.set(l, []));
          
          // Fallback group
          groups.set("Other Services", []);

          rows.forEach((row) => {
            // Find most matching segment label
            let matchedLabel = labels[0];
            
            // Simple keyword matching heuristic per row
            const rowStr = JSON.stringify(row).toLowerCase();
            for (const s of inferredSegments) {
              const labelKeywords = s.label.toLowerCase().split(/\s+/).filter((k: string) => k.length > 3);
              const criteriaKeywords = s.criteria.toLowerCase().split(/\s+/).filter((k: string) => k.length > 3);
              const allKeywords = [...labelKeywords, ...criteriaKeywords];
              
              if (allKeywords.some(keyword => rowStr.includes(keyword))) {
                matchedLabel = s.label;
                break;
              }
            }

            groups.get(matchedLabel)!.push(row._id);
          });

          segments = Array.from(groups, ([label, rowIds]) => ({ label, rowIds })).filter(s => s.rowIds.length > 0);
        }
      } catch (aiErr) {
        console.error("Groq segmentation failed, falling back to heuristic:", aiErr);
      }
    }

    // 3. Fallback Heuristic if Groq fails or is not key-configured
    if (segments.length === 0) {
      const segKey = cols.find((c) => /industry|segment|category|company|title|role/i.test(c)) ?? cols[0];
      const groups = new Map<string, string[]>();
      
      rows.forEach((row) => {
        const val = String(row[segKey] ?? "Uncategorized").trim();
        const k = val || "Uncategorized";
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(row._id);
      });

      segments = Array.from(groups, ([label, rowIds]) => ({
        label,
        rowIds
      }));
    }

    // 4. Save segments to DB (clear old segments first to prevent bloating)
    await supabase.from("segments").delete().eq("csv_id", id);

    const insertedSegments = await Promise.all(
      segments.map(async (seg) => {
        const { data, error } = await supabase
          .from("segments")
          .insert({
            csv_id: id,
            label: seg.label,
            row_ids: seg.rowIds
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data;
      })
    );

    return res.json(
      insertedSegments.map((s) => ({
        id: s.id,
        label: s.label,
        rowIds: s.row_ids
      }))
    );
  } catch (err) {
    console.error("Error segmenting CSV:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 8. POST /admin/csv/:id/assign
router.post("/csv/:id/assign", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const adminId = req.user!.id;
  const { senderId, segmentId } = req.body;

  if (!senderId) {
    return res.status(400).json({ error: "Missing required field: senderId." });
  }

  try {
    // 1. Verify CSV belongs to this admin
    const { data: csv, error: csvErr } = await supabase
      .from("csv_files")
      .select("*")
      .eq("id", id)
      .eq("admin_id", adminId)
      .single();

    if (csvErr || !csv) {
      return res.status(404).json({ error: "CSV not found or unauthorized." });
    }

    // 2. Verify sender belongs to this admin OR is the admin themselves (self-assignment)
    let isAuthorized = false;
    if (senderId === adminId) {
      isAuthorized = true;
    } else {
      const { data: sender, error: senderErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", senderId)
        .eq("admin_id", adminId)
        .single();
      if (!senderErr && sender) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(404).json({ error: "Sender not found or unauthorized to be assigned this CSV." });
    }

    // 3. Delete any pre-existing assignments for this sender and CSV, then insert fresh
    await supabase
      .from("csv_assignments")
      .delete()
      .eq("csv_id", id)
      .eq("sender_id", senderId);

    const { error: assignErr } = await supabase
      .from("csv_assignments")
      .insert({
        csv_id: id,
        sender_id: senderId,
        segment_id: segmentId || null
      });

    if (assignErr) return res.status(500).json({ error: assignErr.message });

    return res.json({ ok: true, segmentId });
  } catch (err) {
    console.error("Error assigning CSV:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 9. GET /admin/logs
router.get("/logs", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { senderId, from, to } = req.query;

  try {
    // A. Gather sender profiles under this admin
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("admin_id", adminId)
      .eq("role", "sender");

    const senderMap = new Map((senders || []).map((s) => [s.id, s.name]));
    const senderIds = Array.from(senderMap.keys());

    if (senderIds.length === 0) {
      return res.json([]);
    }

    // B. Build query on email_logs
    let query = supabase.from("email_logs").select("*").in("sender_id", senderIds);

    if (senderId) {
      query = query.eq("sender_id", String(senderId));
    }
    if (from) {
      query = query.gte("timestamp", String(from));
    }
    if (to) {
      query = query.lte("timestamp", String(to));
    }

    const { data: logs, error } = await query.order("timestamp", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Format logs for frontend (matching the structure from mock logs)
    const formattedLogs = (logs || []).map((l) => ({
      id: l.id,
      senderId: l.sender_id,
      senderName: senderMap.get(l.sender_id) || "Assigned Sender",
      recipientEmail: l.recipient_email,
      recipientName: l.recipient_name,
      subject: l.subject,
      body: l.body,
      status: l.status,
      errorMessage: l.error_message,
      timestamp: l.timestamp
    }));

    return res.json(formattedLogs);
  } catch (err) {
    console.error("Error listing admin logs:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// 10. POST /admin/smtp
router.post("/smtp", async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { gmail, appPassword } = req.body;

  if (!gmail || !appPassword) {
    return res.status(400).json({ error: "Missing required fields: gmail, appPassword." });
  }

  try {
    // 1. Encrypt app password before saving to DB
    const encryptedPassword = encrypt(appPassword);

    // 2. Upsert config
    const { error: smtpErr } = await supabase
      .from("smtp_configs")
      .upsert({
        admin_id: adminId,
        gmail,
        encrypted_password: encryptedPassword
      }, { onConflict: "admin_id" });

    if (smtpErr) return res.status(500).json({ error: smtpErr.message });

    // 3. Mark admin profile as SMTP Configured
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ smtp_configured: true })
      .eq("id", adminId);

    if (profileErr) return res.status(500).json({ error: profileErr.message });

    return res.json({ ok: true, gmail });
  } catch (err) {
    console.error("Error setting SMTP:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
