/**
 * campaign.repository.ts — Campaign data access repository
 */

import { BaseRepository } from "../../repositories/base.repository.js";
import { getSupabase } from "../../config/supabase.js";
import type { Campaign } from "../../shared/types.js";

export class CampaignRepository extends BaseRepository<Campaign> {
  protected readonly tableName = "campaigns";

  /**
   * Lists campaigns scoped to an administrator.
   */
  async listCampaigns(adminId: string, limit: number, offset: number): Promise<{ data: Campaign[]; count: number }> {
    const { data, count, error } = await getSupabase()
      .from("campaigns")
      .select("*", { count: "exact" })
      .eq("admin_id", adminId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return {
      data: (data || []) as Campaign[],
      count: count || 0,
    };
  }
}

export const campaignRepository = new CampaignRepository();
