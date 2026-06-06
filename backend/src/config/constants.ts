/**
 * constants.ts — Platform-wide configuration constants
 *
 * Centralizes all magic numbers and business rule constants.
 * Change here → applied everywhere.
 */

// ── Plan Limits ───────────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    maxSenders: 2,
    maxEmailsPerMonth: 500,
    maxAiTokensPerMonth: 10_000,
    maxStorageMb: 50,
    maxTemplates: 5,
    maxCampaigns: 10,
  },
  starter: {
    maxSenders: 5,
    maxEmailsPerMonth: 5_000,
    maxAiTokensPerMonth: 100_000,
    maxStorageMb: 500,
    maxTemplates: 50,
    maxCampaigns: 100,
  },
  growth: {
    maxSenders: 20,
    maxEmailsPerMonth: 50_000,
    maxAiTokensPerMonth: 1_000_000,
    maxStorageMb: 5_000,
    maxTemplates: 500,
    maxCampaigns: 1_000,
  },
  enterprise: {
    maxSenders: Infinity,
    maxEmailsPerMonth: Infinity,
    maxAiTokensPerMonth: Infinity,
    maxStorageMb: Infinity,
    maxTemplates: Infinity,
    maxCampaigns: Infinity,
  },
} as const;

// ── Queue Configuration ───────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL_SEND: "email-send",
  EMAIL_SCHEDULE: "email-schedule",
  EMAIL_DEAD_LETTER: "email-dead-letter",
  AI_GENERATE: "ai-generate",
  ANALYTICS_AGGREGATE: "analytics-aggregate",
  BOUNCE_PROCESS: "bounce-process",
  WEBHOOK_PROCESS: "webhook-process",
  SCHEDULER: "scheduler-cron",
} as const;

export const QUEUE_CONCURRENCY = {
  EMAIL_SEND: 5,           // Per worker instance
  AI_GENERATE: 10,
  ANALYTICS_AGGREGATE: 1,  // Singleton worker — prevents double aggregation
  BOUNCE_PROCESS: 3,
  WEBHOOK_PROCESS: 5,
  SCHEDULER: 2,
} as const;

export const JOB_RETRY = {
  EMAIL_SEND: {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 1_000, // 1s, 5s, 25s
    },
  },
  AI_GENERATE: {
    attempts: 2,
    backoff: {
      type: "fixed" as const,
      delay: 2_000,
    },
  },
  ANALYTICS_AGGREGATE: {
    attempts: 1,
  },
} as const;

export const JOB_TTL_MS = 24 * 60 * 60 * 1_000; // Dead-letter jobs purged after 24h

// ── Rate Limiting ─────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Global rate limit per IP */
  GLOBAL_PER_IP: {
    windowMs: 60_000,     // 1 minute
    max: 60,
  },
  /** Authenticated requests per tenant */
  PER_TENANT: {
    windowMs: 60_000,
    max: 200,
  },
  /** Sender campaign dispatch */
  CAMPAIGN_SEND: {
    windowMs: 60_000,
    max: 5,               // Max 5 campaign dispatches per minute per sender
  },
  /** AI generation requests */
  AI_GENERATE: {
    windowMs: 60_000,
    max: 30,
  },
  /** Auth endpoints */
  AUTH: {
    windowMs: 15 * 60_000, // 15 minutes
    max: 10,
  },
} as const;

// ── Email Configuration ───────────────────────────────────────────────────────

export const EMAIL_CONFIG = {
  /** Minimum delay between individual emails (ms) to avoid spam flags */
  MIN_DELAY_BETWEEN_EMAILS_MS: 200,
  /** Maximum delay between individual emails (ms) */
  MAX_DELAY_BETWEEN_EMAILS_MS: 3_000,
  /** Default batch size for campaign sending */
  DEFAULT_BATCH_SIZE: 50,
  /** Max recipients per single campaign job enqueue */
  MAX_RECIPIENTS_PER_BATCH: 500,
  /** Default per-sender daily email limit */
  DEFAULT_SENDER_DAILY_LIMIT: 500,
} as const;

// ── VIP Priority Scoring ──────────────────────────────────────────────────────

export const VIP_PRIORITY = {
  NORMAL: 0,
  HIGH: 5,
  VIP: 10,
  MAX: 10,
} as const;

// ── Attachment Policy ─────────────────────────────────────────────────────────

export const ATTACHMENT_CONFIG = {
  DEFAULT_MAX_SIZE_MB: 10,
  ALLOWED_MIME_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
  ],
  DANGEROUS_EXTENSIONS: [
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".msi", ".dll",
  ],
} as const;

// ── Analytics ────────────────────────────────────────────────────────────────

export const ANALYTICS_CONFIG = {
  /** How often the hourly rollup worker runs (ms) */
  HOURLY_ROLLUP_INTERVAL_MS: 60 * 60_000,
  /** Retention period for raw email_logs (days) */
  LOG_RETENTION_DAYS: 90,
  /** Retention period for analytics_snapshots (days) */
  SNAPSHOT_RETENTION_DAYS: 365,
} as const;

// ── Deduplication ─────────────────────────────────────────────────────────────

export const DEDUP_CONFIG = {
  /** Default cooldown before a recipient can be re-contacted (days) */
  DEFAULT_COOLDOWN_DAYS: 30,
  /** When sender_override is true, minimum cooldown still enforced (days) */
  MINIMUM_COOLDOWN_DAYS: 7,
} as const;

// ── AI Token Cost Estimates (USD per 1K tokens) ───────────────────────────────

export const AI_TOKEN_COSTS = {
  groq: {
    "llama-3.1-8b-instant": { input: 0.00005, output: 0.00008 },
    "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
  },
  openai: {
    "gpt-4o": { input: 0.005, output: 0.015 },
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  },
  claude: {
    "claude-3-haiku-20240307": { input: 0.00025, output: 0.00125 },
    "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
  },
} as const;

// ── Campaign Status Machine ───────────────────────────────────────────────────

export const CAMPAIGN_STATUS = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  SENDING: "sending",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

// ── Roles ─────────────────────────────────────────────────────────────────────

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SENDER: "sender",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// ── API Versioning ────────────────────────────────────────────────────────────

export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;
