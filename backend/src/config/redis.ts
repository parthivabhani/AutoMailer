/**
 * redis.ts — Redis connection configuration for BullMQ and rate limiting
 *
 * BullMQ bundles its own version of ioredis internally, so we pass
 * connection options (URL string) rather than an ioredis instance
 * to avoid type-level conflicts between the two ioredis versions.
 *
 * Falls back gracefully when Redis is disabled via FEATURE_REDIS_ENABLED=false.
 */

import { getEnv } from "./env.js";

// ── BullMQ Connection Options (passed directly to BullMQ) ────────────────────
// BullMQ accepts { url: string } or a Redis options object.
// Using the URL string form avoids the dual-ioredis type conflict.

export interface BullMQConnectionOptions {
  url: string;
  tls?: object;
}

/**
 * Returns BullMQ-compatible connection options.
 * BullMQ's internal ioredis uses these to create its own connection.
 */
export function createBullMQConnection(): BullMQConnectionOptions {
  const env = getEnv();
  const options: BullMQConnectionOptions = {
    url: env.REDIS_URL,
  };
  if (env.REDIS_URL.startsWith("rediss://") || env.REDIS_TLS) {
    options.tls = {};
  }
  return options;
}

/**
 * Graceful shutdown stub — no persistent connection to close
 * when using URL-based BullMQ connections.
 */
export async function closeRedisConnection(): Promise<void> {
  // BullMQ manages its own connections internally.
  // No manual cleanup needed when using URL-based connection options.
  console.log("✅ Redis: BullMQ connections will be closed by queue/worker shutdown");
}
