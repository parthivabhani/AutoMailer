/**
 * contacts.repository.ts — Contacts and CSV list data repository
 */

import { BaseRepository } from "../../repositories/base.repository.js";
import { getSupabase, getSupabaseAdmin } from "../../config/supabase.js";
import type { Contact } from "../../shared/types.js";

export class ContactsRepository extends BaseRepository<Contact> {
  protected readonly tableName = "contacts";

  /**
   * Retrieves all CSV files uploaded by an admin.
   */
  async listCsvFiles(adminId: string) {
    const { data, error } = await getSupabase()
      .from("csv_files")
      .select("*")
      .eq("admin_id", adminId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Inserts a CSV file record.
   */
  async insertCsvFile(adminId: string, name: string, columns: string[], rows: any[]) {
    const { data, error } = await getSupabase()
      .from("csv_files")
      .insert({
        admin_id: adminId,
        name,
        columns,
        rows,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Retrieves segments by CSV ID.
   */
  async getSegments(csvId: string) {
    const { data, error } = await getSupabase().from("segments").select("*").eq("csv_id", csvId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Retrieves assignments for a CSV.
   */
  async getAssignments(csvId: string) {
    const { data, error } = await getSupabase()
      .from("csv_assignments")
      .select("sender_id")
      .eq("csv_id", csvId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Deletes all segments associated with a CSV file.
   */
  async deleteSegments(csvId: string): Promise<void> {
    const { error } = await getSupabase().from("segments").delete().eq("csv_id", csvId);

    if (error) throw error;
  }

  /**
   * Saves a new segment record.
   */
  async insertSegment(csvId: string, label: string, rowIds: string[]) {
    const { data, error } = await getSupabase()
      .from("segments")
      .insert({
        csv_id: csvId,
        label,
        row_ids: rowIds,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Removes pre-existing CSV assignments.
   */
  async deleteAssignment(csvId: string, senderId: string): Promise<void> {
    await getSupabase()
      .from("csv_assignments")
      .delete()
      .eq("csv_id", csvId)
      .eq("sender_id", senderId);
  }

  /**
   * Creates a CSV assignment to a sender.
   */
  async insertAssignment(csvId: string, senderId: string, segmentId?: string | null) {
    const { data, error } = await getSupabase()
      .from("csv_assignments")
      .insert({
        csv_id: csvId,
        sender_id: senderId,
        segment_id: segmentId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Performs bulk upsert of contacts into the normalized contacts table.
   */
  async bulkUpsertContacts(contacts: any[]): Promise<void> {
    if (contacts.length === 0) return;

    // Using Supabase Admin client to write contact records safely
    const { error } = await getSupabaseAdmin()
      .from("contacts")
      .upsert(contacts, { onConflict: "business_id, email" });

    if (error) throw error;
  }
}

export const contactsRepository = new ContactsRepository();
