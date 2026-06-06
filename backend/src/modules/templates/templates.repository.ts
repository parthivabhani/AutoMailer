/**
 * templates.repository.ts — Template data access repository
 */

import { BaseRepository } from "../../repositories/base.repository.js";
import { getSupabase } from "../../config/supabase.js";
import type { Template } from "../../shared/types.js";

export class TemplatesRepository extends BaseRepository<Template> {
  protected readonly tableName = "templates";

  /**
   * Retrieves templates belonging to a business and either created by the user or shared.
   */
  async listTemplates(
    businessId: string,
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ data: Template[]; count: number }> {
    const { data, count, error } = await getSupabase()
      .from("templates")
      .select("*", { count: "exact" })
      .eq("business_id", businessId)
      .or(`created_by.eq.${userId},is_shared.eq.true`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return {
      data: (data || []) as Template[],
      count: count || 0,
    };
  }
}

export const templatesRepository = new TemplatesRepository();
