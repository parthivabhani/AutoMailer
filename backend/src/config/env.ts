/**
 * env.ts — Zod-validated environment configuration
 *
 * Validates all required environment variables at startup.
 * The application will crash fast with a clear error if any required
 * variable is missing, rather than failing silently at runtime.
 */

import { z } from "zod";

const envSchema = z.object({
  // ── Core ──────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  // ── Supabase ──────────────────────────────────────────────────────────────
  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL must be a valid URL" }),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_TLS: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  // ── AI Providers ──────────────────────────────────────────────────────────
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_DEFAULT_PROVIDER: z.enum(["groq", "openai", "claude"]).default("groq"),

  // ── Encryption ────────────────────────────────────────────────────────────
  SMTP_ENCRYPTION_SECRET: z
    .string()
    .min(32, "SMTP_ENCRYPTION_SECRET must be at least 32 characters")
    .default("default_encryption_secret_must_be_32_bytes_long!!"),

  // ── Billing (optional) ────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ── Security ──────────────────────────────────────────────────────────────
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  JWT_AUDIENCE: z.string().default("authenticated"),

  // ── Feature Flags ─────────────────────────────────────────────────────────
  FEATURE_BILLING_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  FEATURE_ATTACHMENT_SCAN: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  FEATURE_REALTIME_QUEUE: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  FEATURE_REDIS_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment configuration:");
    parsed.error.issues.forEach((issue) => {
      console.error(`   [${issue.path.join(".")}] ${issue.message}`);
    });
    process.exit(1);
  }

  _env = parsed.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) {
    throw new Error("Environment not loaded. Call loadEnv() first in your entry point.");
  }
  return _env;
}

// Convenience re-export for direct destructuring
export const env = new Proxy({} as Env, {
  get(_, key: string) {
    return getEnv()[key as keyof Env];
  },
});
