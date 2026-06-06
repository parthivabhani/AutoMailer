/**
 * admin.service.ts — Administrator business logic
 */

import { adminRepository } from "./admin.repository.js";
import { getSupabase, getSupabaseAdmin } from "../../config/supabase.js";
import { encrypt } from "../../shared/crypto.js";
import { AppError, NotFoundError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { getEnv } from "../../config/env.js";

export class AdminService {
  /**
   * Fetches statistics summary for the admin dashboard.
   */
  async getStats(adminId: string, businessId: string) {
    const senders = await adminRepository.listSenders(adminId);
    const senderIds = senders.map((s) => s.id);

    // Fetch lists count
    const { count: csvCount, error: csvErr } = await getSupabase()
      .from("csv_files")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", adminId);

    if (csvErr) throw csvErr;

    const totals = await adminRepository.getStatsTotals(senderIds);

    const deliverySuccessRate =
      totals.sent + totals.failed > 0
        ? Math.round((totals.sent / (totals.sent + totals.failed)) * 100)
        : 100;

    return {
      activeSenders: senders.length,
      listsUploaded: csvCount || 0,
      emailsSent: totals.sent,
      emailsFailed: totals.failed,
      emailsSkipped: totals.skipped,
      deliverySuccessRate,
      monthlyVolume: [
        { name: "Week 1", sent: Math.round(totals.sent * 0.2), failed: Math.round(totals.failed * 0.2) },
        { name: "Week 2", sent: Math.round(totals.sent * 0.25), failed: Math.round(totals.failed * 0.25) },
        { name: "Week 3", sent: Math.round(totals.sent * 0.25), failed: Math.round(totals.failed * 0.25) },
        { name: "Week 4", sent: Math.round(totals.sent * 0.3), failed: Math.round(totals.failed * 0.3) },
      ],
    };
  }

  /**
   * Lists all senders registered under this admin, with total sent emails.
   */
  async getSenders(adminId: string) {
    const senders = await adminRepository.listSenders(adminId);

    return await Promise.all(
      senders.map(async (s) => {
        const emailsSent = await adminRepository.getSentCount(s.id);

        // Fetch assigned lists
        const { data: assignments } = await getSupabase()
          .from("csv_assignments")
          .select("csv_id")
          .eq("sender_id", s.id);

        const csvIds = (assignments || []).map((a) => a.csv_id);

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          assignedCsvIds: csvIds,
          emailsSent,
          createdAt: s.created_at,
        };
      })
    );
  }

  /**
   * Registers a new sender and creates their auth.users account in Supabase.
   */
  async createSender(adminId: string, businessId: string, payload: any) {
    const { name, email, password } = payload;
    let newUserId: string;

    const env = getEnv();

    // Use admin client if service role is available to skip email confirmation
    if (env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: authUser, error: authErr } = await getSupabaseAdmin().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: "sender" },
      });

      if (authErr || !authUser.user) {
        throw new AppError(authErr?.message || "Failed to create authentication account.", 400, "AUTH_CREATION_FAILED");
      }
      newUserId = authUser.user.id;
    } else {
      const { data: authUser, error: authErr } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
          data: { name, role: "sender" },
        },
      });

      if (authErr || !authUser.user) {
        throw new AppError(authErr?.message || "Failed to sign up sender.", 400, "AUTH_SIGNUP_FAILED");
      }
      newUserId = authUser.user.id;
    }

    // Insert user profile record linked to admin & business
    const inserted = await adminRepository.insert({
      id: newUserId,
      name,
      email,
      role: "sender",
      admin_id: adminId,
      business_id: businessId,
      status: "active",
    } as any);

    return {
      id: inserted.id,
      name: inserted.name,
      email: inserted.email,
      assignedCsvIds: [],
      emailsSent: 0,
      createdAt: (inserted as any).created_at || new Date().toISOString(),
    };
  }

  /**
   * Deletes a sender account.
   */
  async deleteSender(adminId: string, senderId: string) {
    const sender = await getSupabase()
      .from("profiles")
      .select("*")
      .eq("id", senderId)
      .eq("admin_id", adminId)
      .single();

    if (!sender.data) {
      throw new NotFoundError("Sender");
    }

    // Delete Auth account using service client if available
    const env = getEnv();
    if (env.SUPABASE_SERVICE_ROLE_KEY) {
      await getSupabaseAdmin().auth.admin.deleteUser(senderId);
    }

    // Delete database profile
    await adminRepository.delete(senderId, sender.data.business_id);
    return { success: true };
  }

  /**
   * Configures SMTP sending details.
   */
  async setSmtpConfig(adminId: string, gmail: string, appPassword: string) {
    logger.info({ adminId, gmail }, "Updating SMTP configuration");
    const encryptedPassword = encrypt(appPassword);

    await adminRepository.upsertSmtpConfig(adminId, gmail, encryptedPassword);
    await adminRepository.setProfileSmtpConfigured(adminId, true);

    return { ok: true, gmail };
  }

  /**
   * Retrieves log histories for all senders managed by this administrator.
   */
  async getLogs(adminId: string, filters: any) {
    const senders = await adminRepository.listSenders(adminId);
    const senderMap = new Map(senders.map((s) => [s.id, s.name]));
    const senderIds = Array.from(senderMap.keys());

    if (senderIds.length === 0) {
      return [];
    }

    const logs = await adminRepository.getLogs(senderIds, filters);

    return logs.map((l: any) => ({
      id: l.id,
      senderId: l.sender_id,
      senderName: senderMap.get(l.sender_id) || "Assigned Sender",
      recipientEmail: l.recipient_email,
      recipientName: l.recipient_name,
      subject: l.subject,
      body: l.body,
      status: l.status,
      errorMessage: l.error_message,
      timestamp: l.timestamp,
    }));
  }
}

export const adminService = new AdminService();
