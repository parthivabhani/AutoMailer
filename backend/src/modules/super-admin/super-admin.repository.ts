/**
 * super-admin.repository.ts — Platform-wide data access for super admins
 */

import { BaseRepository } from "../../repositories/base.repository.js";
import { getSupabaseAdmin } from "../../config/supabase.js";
import type { Profile } from "../../shared/types.js";

export class SuperAdminRepository extends BaseRepository<Profile> {
  protected readonly tableName = "profiles";

  /**
   * Retrieves all administrator accounts on the platform.
   */
  async listAllAdmins(): Promise<Profile[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Profile[];
  }

  /**
   * Updates an admin's account status.
   */
  async updateAdminStatus(id: string, status: "active" | "suspended"): Promise<Profile> {
    const { data, error } = await getSupabaseAdmin()
      .from("profiles")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  }

  /**
   * Aggregates platform-wide email stats.
   */
  async getPlatformStats(): Promise<{
    totalAdmins: number;
    emailsSent: number;
    emailsFailed: number;
    emailsSkipped: number;
  }> {
    const supabase = getSupabaseAdmin();

    const [adminRes, sentRes, failRes, skipRes] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin"),
      supabase.from("email_logs").select("*", { count: "exact", head: true }).eq("status", "sent"),
      supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "skipped_duplicate"),
    ]);

    if (adminRes.error) throw adminRes.error;
    if (sentRes.error) throw sentRes.error;
    if (failRes.error) throw failRes.error;
    if (skipRes.error) throw skipRes.error;

    return {
      totalAdmins: adminRes.count || 0,
      emailsSent: sentRes.count || 0,
      emailsFailed: failRes.count || 0,
      emailsSkipped: skipRes.count || 0,
    };
  }
}

export const superAdminRepository = new SuperAdminRepository();
