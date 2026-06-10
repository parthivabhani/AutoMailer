/**
 * ai.service.ts — AI usage tracking, capacity guard, and response caching
 *
 * Implements:
 * - Subscription token limit validation (capacity check)
 * - Cache lookup and write for repetitive AI calls (drafts, humanizations)
 * - Token allocation tracking
 */

import { getSupabaseAdmin } from "../config/supabase.js";
import { createBullMQConnection } from "../config/redis.js";
import { logger } from "../shared/logger.js";
import { getEnv } from "../config/env.js";

const CACHE_TTL_SECONDS = 3600 * 24; // Cache AI results for 24 hours

export class AIService {
  private _redis: any = null;

  private getRedis() {
    if (this._redis) return this._redis;
    if (getEnv().FEATURE_REDIS_ENABLED) {
      try {
        const IORedis = (global as any).IORedis || require("ioredis");
        this._redis = new IORedis(getEnv().REDIS_URL);
      } catch {
        // Fallback to null (no Redis caching)
      }
    }
    return this._redis;
  }

  // Fallback in-memory cache if Redis is disabled
  private _memoryCache = new Map<string, { value: string; expiresAt: number }>();

  /**
   * Generates a cache key based on prompt parameters.
   */
  getCacheKey(operation: string, params: Record<string, any>): string {
    const serialized = JSON.stringify(params);
    // Simple hash/string key
    return `ai_cache:${operation}:${Buffer.from(serialized).toString("base64").slice(0, 100)}`;
  }

  /**
   * Retrieves cached AI result if available.
   */
  async getCachedResult(key: string): Promise<string | null> {
    try {
      const redis = this.getRedis();
      if (redis) {
        return await redis.get(key);
      }
    } catch (err) {
      logger.warn({ err }, "Redis cache get failed");
    }

    const cached = this._memoryCache.get(key);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        return cached.value;
      }
      this._memoryCache.delete(key);
    }
    return null;
  }

  /**
   * Caches an AI result.
   */
  async setCachedResult(key: string, value: string): Promise<void> {
    try {
      const redis = this.getRedis();
      if (redis) {
        await redis.set(key, value, "EX", CACHE_TTL_SECONDS);
        return;
      }
    } catch (err) {
      logger.warn({ err }, "Redis cache set failed");
    }

    this._memoryCache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });
  }

  /**
   * Checks if a business has remaining AI token capacity based on subscription plan.
   */
  async checkAICapacity(businessId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("ai_tokens_used, ai_tokens_limit, plan")
      .eq("business_id", businessId)
      .single();

    if (error || !sub) {
      // If no subscription record, assume free tier limits (10,000 tokens)
      const { data: usageLogs } = await supabase
        .from("ai_usage")
        .select("total_tokens")
        .eq("business_id", businessId);

      const totalUsed = (usageLogs || []).reduce((sum, u) => sum + u.total_tokens, 0);
      return totalUsed < 10000;
    }

    return sub.ai_tokens_used < sub.ai_tokens_limit;
  }

  /**
   * Increments a business's AI token usage count.
   */
  async trackTokensUsed(businessId: string, tokens: number): Promise<void> {
    const supabase = getSupabaseAdmin();

    try {
      // Try to increment the subscription record counter
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, ai_tokens_used")
        .eq("business_id", businessId)
        .single();

      if (sub) {
        await supabase
          .from("subscriptions")
          .update({
            ai_tokens_used: sub.ai_tokens_used + tokens,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      } else {
        // Create a stub subscription if none exists to track usage
        await supabase.from("subscriptions").insert({
          business_id: businessId,
          plan: "free",
          status: "active",
          ai_tokens_used: tokens,
          ai_tokens_limit: 10000,
          emails_used: 0,
          emails_limit: 500,
        });
      }
    } catch (err) {
      logger.error(
        { err, businessId, tokens },
        "Failed to increment AI token usage in subscription",
      );
    }
  }
}

export const aiService = new AIService();
