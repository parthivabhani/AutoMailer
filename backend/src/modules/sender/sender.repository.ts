/**
 * sender.repository.ts — Sender data access repository
 */

import { BaseRepository } from "../../repositories/base.repository.js";
import { getSupabase } from "../../config/supabase.js";
import type { Profile } from "../../shared/types.js";

export class SenderRepository extends BaseRepository<Profile> {
  protected readonly tableName = "profiles";

  /**
   * Retrieves all CSV assignments for a specific sender.
   */
  async getAssignments(senderId: string) {
    const { data, error } = await getSupabase()
      .from("csv_assignments")
      .select("*")
      .eq("sender_id", senderId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Retrieves CSV files matching a list of IDs.
   */
  async getCsvFilesByIds(csvIds: string[]) {
    if (csvIds.length === 0) return [];

    const { data, error } = await getSupabase().from("csv_files").select("*").in("id", csvIds);

    if (error) throw error;
    return data || [];
  }

  /**
   * Retrieves segments matching a CSV file and optional list of assigned segments.
   */
  async getSegments(csvId: string, assignedSegmentIds: string[]) {
    let query = getSupabase().from("segments").select("*").eq("csv_id", csvId);

    if (assignedSegmentIds.length > 0) {
      query = query.in("id", assignedSegmentIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
}

export const senderRepository = new SenderRepository();
