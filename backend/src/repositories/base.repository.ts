/**
 * base.repository.ts — Abstract base repository with tenant isolation
 *
 * All domain repositories extend this class to ensure queries are
 * automatically scoped by businessId (tenant isolation).
 */

import { getSupabase, getSupabaseAdmin } from "../config/supabase.js";

export abstract class BaseRepository<T> {
  /** The PostgreSQL table name associated with the domain model */
  protected abstract readonly tableName: string;

  /**
   * Returns a standard client or admin client based on query scope.
   */
  protected getClient(useAdmin: boolean = false) {
    return useAdmin ? getSupabaseAdmin() : getSupabase();
  }

  /**
   * Initiates a select query scoped to the tenant's businessId.
   */
  protected scopeQuery(businessId: string, useAdmin: boolean = false) {
    return this.getClient(useAdmin)
      .from(this.tableName)
      .select("*")
      .eq("business_id", businessId);
  }

  /**
   * Find a single record by its ID, scoped to a specific business.
   */
  async findById(id: string, businessId: string): Promise<T | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data as T | null;
  }

  /**
   * Check if a record exists within the tenant's business scope.
   */
  async exists(id: string, businessId: string): Promise<boolean> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select("id")
      .eq("id", id)
      .eq("business_id", businessId)
      .limit(1)
      .maybeSingle();

    if (error) return false;
    return !!data;
  }

  /**
   * Deletes a record by ID, scoped to a specific business.
   */
  async delete(id: string, businessId: string): Promise<boolean> {
    const { error } = await this.getClient()
      .from(this.tableName)
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      throw error;
    }
    return true;
  }

  /**
   * Standard insert helper.
   */
  async insert(record: Partial<T> & { business_id: string }): Promise<T> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .insert(record as any)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as T;
  }

  /**
   * Standard update helper, scoped to a specific business.
   */
  async update(
    id: string,
    businessId: string,
    updates: Partial<T>
  ): Promise<T> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .update(updates as any)
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as T;
  }
}
