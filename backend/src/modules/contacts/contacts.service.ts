/**
 * contacts.service.ts — CSV and contact management service
 */

import { contactsRepository } from "./contacts.repository.js";
import { aiRouter } from "../../ai/ai.router.js";
import { getSupabase } from "../../config/supabase.js";
import { AppError, NotFoundError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";

export class ContactsService {
  /**
   * Lists all CSV files along with their segments and assigned sender IDs.
   */
  async getCsvFiles(adminId: string) {
    const csvs = await contactsRepository.listCsvFiles(adminId);

    return await Promise.all(
      csvs.map(async (c) => {
        const segments = await contactsRepository.getSegments(c.id);
        const assignments = await contactsRepository.getAssignments(c.id);
        const assignedSenderIds = Array.from(new Set(assignments.map((a) => a.sender_id)));

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
          assignedSenderIds,
        };
      }),
    );
  }

  /**
   * Uploads and processes a new CSV contact list.
   * Normalizes the lead rows and writes them to the contacts database table.
   */
  async uploadCsv(
    adminId: string,
    businessId: string,
    name: string,
    columns: string[],
    rows: any[],
  ) {
    // 1. Insert into legacy csv_files table for backward compatibility
    const csv = await contactsRepository.insertCsvFile(adminId, name, columns, rows);

    // 2. Normalize and bulk upsert contacts into the contacts table
    const contactRecords = rows.map((row) => {
      // Find case-insensitive keys for standard fields
      const rowKeys = Object.keys(row);
      const emailKey = rowKeys.find((k) => /^email$/i.test(k)) || "";
      const nameKey = rowKeys.find((k) => /^(name|firstname|first_name)$/i.test(k)) || "";
      const companyKey = rowKeys.find((k) => /^(company|companyname|company_name)$/i.test(k)) || "";
      const titleKey = rowKeys.find((k) => /^(title|role|jobtitle|job_title)$/i.test(k)) || "";

      const email = emailKey
        ? String(row[emailKey]).trim()
        : `no_email_${crypto.randomUUID()}@domain.com`;
      const leadName = nameKey ? String(row[nameKey]).trim() : "Recipient";
      const company = companyKey ? String(row[companyKey]).trim() : "";
      const title = titleKey ? String(row[titleKey]).trim() : "";

      // Check VIP indicators
      const isVip = !!(
        row.is_vip ||
        row.isVip ||
        row._vip ||
        /ceo|founder|director|president/i.test(title)
      );
      const vipScore = row.vip_score || row.vipScore || (isVip ? 80 : 20);

      return {
        business_id: businessId,
        csv_id: csv.id,
        email,
        name: leadName,
        company,
        title,
        data: row,
        is_vip: isVip,
        vip_score: vipScore,
        tags: row.tags || (isVip ? ["vip"] : []),
      };
    });

    try {
      await contactsRepository.bulkUpsertContacts(contactRecords);
    } catch (err) {
      logger.error(
        { err, csvId: csv.id },
        "Failed to perform bulk contacts upsert during CSV upload",
      );
    }

    return {
      id: csv.id,
      name: csv.name,
      uploadedAt: csv.uploaded_at,
      columns: csv.columns,
      rows: csv.rows,
      segments: [],
      assignedSenderIds: [],
    };
  }

  /**
   * Segments a CSV list using the AI provider cascade or heuristic fallbacks.
   */
  async segmentCsv(adminId: string, businessId: string, userId: string, csvId: string) {
    // 1. Fetch CSV data
    const csv = await getSupabase()
      .from("csv_files")
      .select("*")
      .eq("id", csvId)
      .eq("admin_id", adminId)
      .single();

    if (csv.error || !csv.data) {
      throw new NotFoundError("CSV List");
    }

    const rows = csv.data.rows as Array<any>;
    const cols = csv.data.columns as string[];

    if (rows.length === 0) {
      throw new AppError("CSV list is empty.", 400, "EMPTY_LIST");
    }

    let segments: Array<{ label: string; rowIds: string[] }> = [];

    // 2. Perform AI segmentation
    try {
      const response = await aiRouter.segmentContacts({
        rows,
        columns: cols,
        businessId,
        userId,
      });

      const inferred = JSON.parse(response.content as string);

      if (Array.isArray(inferred)) {
        const labels: string[] = inferred.map((s: any) => s.label);
        const groups = new Map<string, string[]>();
        labels.forEach((l) => groups.set(l, []));
        groups.set("Other Services", []);

        rows.forEach((row) => {
          let matchedLabel = labels[0];
          const rowStr = JSON.stringify(row).toLowerCase();

          for (const s of inferred) {
            const labelKeywords = s.label
              .toLowerCase()
              .split(/\s+/)
              .filter((k: string) => k.length > 3);
            const criteriaKeywords = s.criteria
              .toLowerCase()
              .split(/\s+/)
              .filter((k: string) => k.length > 3);
            const allKeywords = [...labelKeywords, ...criteriaKeywords];

            if (allKeywords.some((keyword) => rowStr.includes(keyword))) {
              matchedLabel = s.label;
              break;
            }
          }

          groups.get(matchedLabel)!.push(row._id);
        });

        segments = Array.from(groups, ([label, rowIds]) => ({ label, rowIds })).filter(
          (s) => s.rowIds.length > 0,
        );
      }
    } catch (aiErr) {
      logger.warn({ aiErr }, "AI segmentation failed, falling back to heuristics");
    }

    // 3. Fallback Heuristics
    if (segments.length === 0) {
      const segKey =
        cols.find((c) => /industry|segment|category|company|title|role/i.test(c)) ?? cols[0];
      const groups = new Map<string, string[]>();

      rows.forEach((row) => {
        const val = String(row[segKey] ?? "Uncategorized").trim();
        const k = val || "Uncategorized";
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(row._id);
      });

      segments = Array.from(groups, ([label, rowIds]) => ({ label, rowIds }));
    }

    // 4. Save segments to DB (clear old first)
    await contactsRepository.deleteSegments(csvId);

    const insertedSegments = await Promise.all(
      segments.map(async (seg) => {
        const data = await contactsRepository.insertSegment(csvId, seg.label, seg.rowIds);
        return data;
      }),
    );

    return insertedSegments.map((s) => ({
      id: s.id,
      label: s.label,
      rowIds: s.row_ids,
    }));
  }

  /**
   * Assigns a CSV list to a sender.
   */
  async assignCsv(adminId: string, csvId: string, senderId: string, segmentId?: string | null) {
    // 1. Verify CSV belongs to this admin
    const { data: csv } = await getSupabase()
      .from("csv_files")
      .select("id")
      .eq("id", csvId)
      .eq("admin_id", adminId)
      .single();

    if (!csv) {
      throw new NotFoundError("CSV List");
    }

    // 2. Verify sender belongs to this admin OR is the admin themselves (self-assignment)
    let isAuthorized = false;
    if (senderId === adminId) {
      isAuthorized = true;
    } else {
      const { data: sender } = await getSupabase()
        .from("profiles")
        .select("id")
        .eq("id", senderId)
        .eq("admin_id", adminId)
        .single();
      if (sender) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new AppError(
        "Sender not found or unauthorized to be assigned this list.",
        403,
        "UNAUTHORIZED_ASSIGNMENT",
      );
    }

    // 3. Clear old assignments and insert new
    await contactsRepository.deleteAssignment(csvId, senderId);
    await contactsRepository.insertAssignment(csvId, senderId, segmentId);

    return { ok: true, segmentId };
  }
}

export const contactsService = new ContactsService();
