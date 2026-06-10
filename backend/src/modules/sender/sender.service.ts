/**
 * sender.service.ts — Sender operations service
 */

import { senderRepository } from "./sender.repository.js";
import { getSupabase, getSupabaseAdmin } from "../../config/supabase.js";
import { enqueueCampaignBatch } from "../../queues/email.queue.js";
import { AppError, NotFoundError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";

export class SenderService {
  /**
   * Returns lists and segments assigned to this sender.
   */
  async getAssigned(senderId: string) {
    const assignments = await senderRepository.getAssignments(senderId);
    const csvIds = Array.from(new Set(assignments.map((a) => a.csv_id)));

    if (csvIds.length === 0) {
      return [];
    }

    const csvs = await senderRepository.getCsvFilesByIds(csvIds);

    return await Promise.all(
      csvs.map(async (c) => {
        const assignedSegments = assignments
          .filter((a) => a.csv_id === c.id && a.segment_id !== null)
          .map((a) => a.segment_id);

        const segments = await senderRepository.getSegments(c.id, assignedSegments);

        return {
          id: c.id,
          name: c.name,
          uploadedAt: c.uploaded_at,
          columns: c.columns,
          rows: c.rows,
          segments: segments.map((s) => ({
            id: s.id,
            label: s.label,
            rowIds: s.row_ids,
          })),
          assignedSenderIds: [senderId],
        };
      }),
    );
  }

  /**
   * Processes a campaign cold send by enqueuing the emails.
   */
  async queueColdSend(
    senderId: string,
    adminId: string,
    businessId: string,
    payload: {
      csvId: string;
      segmentId?: string;
      subject: string;
      body: string;
      recipientIds: string[];
    },
  ) {
    const { csvId, segmentId, subject, body, recipientIds } = payload;
    const supabase = getSupabase();

    // 1. Verify parent Admin SMTP config exists
    const { data: smtpConfig } = await supabase
      .from("smtp_configs")
      .select("id, gmail")
      .eq("admin_id", adminId)
      .single();

    if (!smtpConfig) {
      throw new AppError(
        "No SMTP configuration found for this outreach campaign. Configure SMTP credentials first.",
        400,
        "SMTP_MISSING",
      );
    }

    // 2. Fetch the CSV File to verify recipient IDs
    const { data: csvFile } = await supabase.from("csv_files").select("*").eq("id", csvId).single();

    if (!csvFile) {
      throw new NotFoundError("CSV Campaign list");
    }

    const rows = csvFile.rows as Array<any>;
    const targetedRecipients = rows.filter((r) => recipientIds.includes(r._id));

    if (targetedRecipients.length === 0) {
      throw new AppError(
        "No matching recipients identified for campaign dispatch.",
        400,
        "NO_RECIPIENTS",
      );
    }

    // 3. Create an ad-hoc campaign record to integrate with our modern queues and analytics
    const { data: campaign, error: campaignErr } = await getSupabaseAdmin()
      .from("campaigns")
      .insert({
        business_id: businessId,
        admin_id: adminId,
        name: `Quick Send - ${new Date().toLocaleDateString()}`,
        status: "sending",
        subject_template: subject,
        body_template: body,
        sender_override: false,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (campaignErr || !campaign) {
      logger.error({ campaignErr }, "Failed to create ad-hoc campaign for send");
      throw new AppError("Failed to initiate campaign record.", 500, "DATABASE_ERROR");
    }

    // 4. Create campaign job entries in DB (marked as pending)
    const jobRecords = targetedRecipients.map((recipient) => {
      const email = (recipient.email || recipient.Email || "").trim();
      const priority = recipient.is_vip ? 10 : 0;

      return {
        campaign_id: campaign.id,
        business_id: businessId,
        sender_id: senderId,
        recipient_email: email,
        recipient_data: recipient,
        status: "pending",
        priority,
      };
    });

    await getSupabaseAdmin().from("campaign_jobs").insert(jobRecords);

    // 5. Enqueue campaign batch in BullMQ
    const { total, jobIds } = await enqueueCampaignBatch(
      targetedRecipients.map((r) => ({
        email: r.email || r.Email || "",
        data: r,
        isVip: !!r.is_vip,
        vipScore: r.vip_score || 0,
      })),
      {
        businessId,
        campaignId: campaign.id,
        senderId,
        adminId,
        subjectTemplate: subject,
        bodyTemplate: body,
        senderOverride: false,
        delayBetweenEmailsMs: 300, // Safe default stagger pacing
        attachments: [],
      },
    );

    return {
      success: true,
      campaignId: campaign.id,
      recipientsQueued: total,
      message: `Enqueued ${total} cold outreach emails for delivery.`,
    };
  }
}

export const senderService = new SenderService();
