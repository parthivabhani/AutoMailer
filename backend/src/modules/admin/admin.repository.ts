/**
 * admin.repository.ts — Admin data access repository
 */

import { BaseRepository } from "../../repositories/base.repository.js";
import { getSupabase, getSupabaseAdmin } from "../../config/supabase.js";
import type { Profile } from "../../shared/types.js";

export class AdminRepository extends BaseRepository<Profile> {
  protected readonly tableName = "profiles";

  /**
   * Retrieves all senders registered under an administrator.
   */
  async listSenders(adminId: string): Promise<Profile[]> {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("*")
      .eq("admin_id", adminId)
      .eq("role", "sender")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Profile[];
  }

  /**
   * Checks how many emails have been sent by a specific sender.
   */
  async getSentCount(senderId: string): Promise<number> {
    const { count, error } = await getSupabase()
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", senderId)
      .eq("status", "sent");

    if (error) throw error;
    return count || 0;
  }

  /**
   * Aggregates email counts (sent, failed, skipped) for all senders under an admin.
   */
  async getStatsTotals(senderIds: string[]): Promise<{
    sent: number;
    failed: number;
    skipped: number;
  }> {
    if (senderIds.length === 0) {
      return { sent: 0, failed: 0, skipped: 0 };
    }

    const supabase = getSupabase();
    const [sentRes, failRes, skipRes] = await Promise.all([
      supabase
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .in("sender_id", senderIds)
        .eq("status", "sent"),
      supabase
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .in("sender_id", senderIds)
        .eq("status", "failed"),
      supabase
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .in("sender_id", senderIds)
        .eq("status", "skipped_duplicate"),
    ]);

    return {
      sent: sentRes.count || 0,
      failed: failRes.count || 0,
      skipped: skipRes.count || 0,
    };
  }

  /**
   * Registers a new SMTP credential configuration.
   */
  async upsertSmtpConfig(adminId: string, gmail: string, encryptedPass: string): Promise<void> {
    const { error } = await getSupabase().from("smtp_configs").upsert(
      {
        admin_id: adminId,
        gmail,
        encrypted_password: encryptedPass,
      },
      { onConflict: "admin_id" },
    );

    if (error) throw error;
  }

  /**
   * Sets the SMTP configured status for a profile.
   */
  async setProfileSmtpConfigured(profileId: string, configured: boolean): Promise<void> {
    const { error } = await getSupabase()
      .from("profiles")
      .update({ smtp_configured: configured })
      .eq("id", profileId);

    if (error) throw error;
  }

  /**
   * Retrieves email logs filtered by sender IDs and date range.
   */
  async getLogs(senderIds: string[], filters: { senderId?: string; from?: string; to?: string }) {
    const supabase = getSupabase();
    let query = supabase.from("email_logs").select("*").in("sender_id", senderIds);

    if (filters.senderId) {
      query = query.eq("sender_id", filters.senderId);
    }
    if (filters.from) {
      query = query.gte("timestamp", filters.from);
    }
    if (filters.to) {
      query = query.lte("timestamp", filters.to);
    }

    const { data, error } = await query.order("timestamp", { ascending: false });
    if (error) throw error;
    return data || [];
  }
}

export const adminRepository = new AdminRepository();
