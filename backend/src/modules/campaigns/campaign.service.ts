/**
 * campaign.service.ts — Campaign operations service
 */

import { campaignRepository } from "./campaign.repository.js";
import { getSupabase, getSupabaseAdmin } from "../../config/supabase.js";
import { scheduleEmailCampaign, enqueueCampaignBatch } from "../../queues/email.queue.js";
import { AppError, NotFoundError } from "../../shared/errors.js";
import { CAMPAIGN_STATUS } from "../../config/constants.js";
import { logger } from "../../shared/logger.js";

export class CampaignService {
  /**
   * Retrieves paginated list of campaigns.
   */
  async getCampaigns(adminId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const { data, count } = await campaignRepository.listCampaigns(adminId, limit, offset);
    return {
      data,
      count,
      hasMore: offset + limit < count,
    };
  }

  /**
   * Creates a new email campaign.
   */
  async createCampaign(adminId: string, businessId: string, payload: any) {
    const campaign = await campaignRepository.insert({
      business_id: businessId,
      admin_id: adminId,
      name: payload.name,
      status: payload.scheduledAt ? CAMPAIGN_STATUS.SCHEDULED : CAMPAIGN_STATUS.DRAFT,
      subject_template: payload.subjectTemplate,
      body_template: payload.bodyTemplate,
      scheduled_at: payload.scheduledAt || null,
      timezone: payload.timezone,
      delay_between_emails_ms: payload.delayBetweenEmailsMs,
      sender_override: payload.senderOverride,
      batch_size: payload.batchSize,
      priority: payload.priority,
    } as any);

    // If scheduled, register the delayed BullMQ job
    if (payload.scheduledAt) {
      await scheduleEmailCampaign(
        campaign.id,
        new Date(payload.scheduledAt),
        payload.timezone
      );
    }

    return campaign;
  }

  /**
   * Updates an existing campaign.
   */
  async updateCampaign(adminId: string, campaignId: string, payload: any) {
    const existing = await campaignRepository.findById(campaignId, payload.businessId || adminId);

    if (!existing) {
      throw new NotFoundError("Campaign");
    }

    if (existing.status === CAMPAIGN_STATUS.SENDING) {
      throw new AppError("Cannot edit a campaign that is currently sending. Pause it first.", 409, "CAMPAIGN_SENDING");
    }

    const updateData: Record<string, any> = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.subjectTemplate !== undefined) updateData.subject_template = payload.subjectTemplate;
    if (payload.bodyTemplate !== undefined) updateData.body_template = payload.bodyTemplate;
    if (payload.senderOverride !== undefined) updateData.sender_override = payload.senderOverride;
    if (payload.scheduledAt !== undefined) {
      updateData.scheduled_at = payload.scheduledAt;
      updateData.status = payload.scheduledAt ? CAMPAIGN_STATUS.SCHEDULED : CAMPAIGN_STATUS.DRAFT;
    }

    return await campaignRepository.update(campaignId, existing.business_id, updateData);
  }

  /**
   * Triggers background campaign send.
   */
  async launchCampaign(adminId: string, businessId: string, campaignId: string, payload: any) {
    const effectiveSenderId = payload.senderId || adminId;

    // 1. Fetch campaign
    const campaign = await campaignRepository.findById(campaignId, businessId);
    if (!campaign) {
      throw new NotFoundError("Campaign");
    }

    if (campaign.status === CAMPAIGN_STATUS.SENDING) {
      throw new AppError("Campaign is already sending", 409, "ALREADY_SENDING");
    }

    // 2. Fetch recipient data from CSV
    const { data: csvFile } = await getSupabase()
      .from("csv_files")
      .select("rows")
      .eq("id", payload.csvId)
      .single();

    if (!csvFile) {
      throw new NotFoundError("CSV List");
    }

    const allRows = csvFile.rows as Record<string, any>[];
    const targetRows = allRows.filter((r) => payload.recipientIds.includes(r._id));

    if (targetRows.length === 0) {
      throw new AppError("No matching recipients found in CSV", 400, "NO_RECIPIENTS");
    }

    // 3. Mark campaign as sending
    await campaignRepository.update(campaign.id, businessId, {
      status: CAMPAIGN_STATUS.SENDING,
      started_at: new Date().toISOString(),
    } as any);

    // 4. Create campaign_jobs records
    const jobRecords = targetRows.map((row) => ({
      campaign_id: campaign.id,
      business_id: businessId,
      sender_id: effectiveSenderId,
      recipient_email: row.email || row.Email || row.EMAIL || "",
      recipient_data: row,
      status: "pending",
      priority: row._vip ? 10 : campaign.priority,
    }));

    await getSupabaseAdmin().from("campaign_jobs").insert(jobRecords);

    // 5. Enqueue all recipients via BullMQ
    const { total } = await enqueueCampaignBatch(
      targetRows.map((row) => ({
        email: row.email || row.Email || "",
        data: row,
        isVip: !!row._vip,
        vipScore: row._vip_score || 0,
      })),
      {
        businessId,
        campaignId: campaign.id,
        senderId: effectiveSenderId,
        adminId,
        subjectTemplate: campaign.subject_template,
        bodyTemplate: campaign.body_template,
        senderOverride: campaign.sender_override,
        delayBetweenEmailsMs: campaign.delay_between_emails_ms,
        attachments: [],
      }
    );

    return {
      campaignId: campaign.id,
      status: "sending",
      recipientsQueued: total,
    };
  }

  /**
   * Pauses an active sending campaign.
   */
  async pauseCampaign(adminId: string, businessId: string, campaignId: string) {
    const campaign = await campaignRepository.findById(campaignId, businessId);
    if (!campaign) {
      throw new NotFoundError("Campaign");
    }

    const updated = await campaignRepository.update(campaignId, businessId, {
      status: CAMPAIGN_STATUS.PAUSED,
      paused_at: new Date().toISOString(),
    } as any);

    return { campaignId: updated.id, status: "paused" };
  }
}

export const campaignService = new CampaignService();
