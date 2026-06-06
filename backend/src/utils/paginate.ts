/**
 * paginate.ts — Pagination helpers for Supabase queries
 *
 * Provides a standardized way to apply range limits to Supabase client
 * query builders and format the result into a PaginatedResult.
 */

import type { PaginatedResult } from "../shared/types.js";

interface PaginateOptions {
  page?: number;
  limit?: number;
}

/**
 * Executes a Supabase query builder with range limits applied
 * and formats the output into a PaginatedResult structure.
 *
 * Ensure you chain `.select("*", { count: "exact" })` or similar count option
 * to the query builder before passing it to this function.
 *
 * Example:
 *   const query = getSupabase().from("campaigns").select("*", { count: "exact" }).eq("admin_id", adminId);
 *   const result = await paginate(query, { page: 1, limit: 10 });
 */
export async function paginate<T>(
  queryBuilder: any,
  options: PaginateOptions = {}
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 20)));
  const offset = (page - 1) * limit;

  const { data, count, error } = await queryBuilder
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  const total = count ?? 0;

  return {
    data: (data || []) as T[],
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
}
