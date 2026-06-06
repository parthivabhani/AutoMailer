/**
 * types.ts — Shared TypeScript interfaces and type definitions
 *
 * Central location for all domain types used across modules.
 * Import from here to avoid circular dependencies.
 */

import type { Request } from "express";
import type { Role } from "../config/constants.js";

// ── Tenant Context ────────────────────────────────────────────────────────────

export interface TenantContext {
  /** Authenticated user's Supabase auth UUID */
  userId: string;
  /** Backward compatibility alias for userId (used in existing routes) */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** RBAC role */
  role: Role;
  /** Business/tenant UUID — present for admin and sender roles */
  businessId?: string;
  /** Parent admin UUID — present for sender role */
  adminId?: string;
  /** Whether the business SMTP is configured */
  smtpConfigured?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: TenantContext;
  /** Raw JWT token (set by auth middleware) */
  token?: string;
}

// ── Business / Tenant ─────────────────────────────────────────────────────────

export type BusinessPlan = "free" | "starter" | "growth" | "enterprise";
export type BusinessStatus = "active" | "suspended" | "trial";

export interface Business {
  id: string;
  name: string;
  slug: string;
  plan: BusinessPlan;
  status: BusinessStatus;
  max_senders: number;
  max_emails_per_month: number;
  stripe_customer_id?: string;
  created_at: string;
  suspended_at?: string;
  suspended_reason?: string;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  business_id?: string;
  admin_id?: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  smtp_configured: boolean;
  permissions: Record<string, boolean>;
  last_active_at?: string;
  created_at: string;
}

// ── Campaign ──────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "paused"
  | "completed"
  | "cancelled";

export interface Campaign {
  id: string;
  business_id: string;
  admin_id: string;
  name: string;
  status: CampaignStatus;
  subject_template: string;
  body_template: string;
  scheduled_at?: string;
  timezone: string;
  delay_between_emails_ms: number;
  sender_override: boolean;
  batch_size: number;
  priority: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
}

export interface CampaignJob {
  id: string;
  campaign_id: string;
  business_id: string;
  sender_id: string;
  recipient_email: string;
  recipient_data: Record<string, any>;
  status: "pending" | "processing" | "sent" | "failed" | "skipped" | "cancelled";
  priority: number;
  bullmq_job_id?: string;
  attempts: number;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

// ── Contact ───────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  business_id: string;
  csv_id?: string;
  email: string;
  name?: string;
  company?: string;
  title?: string;
  data: Record<string, any>;
  is_vip: boolean;
  vip_score: number;
  tags: string[];
  created_at: string;
}

// ── Email Log ─────────────────────────────────────────────────────────────────

export type EmailLogStatus = "sent" | "failed" | "skipped_duplicate" | "skipped_policy";

export interface EmailLog {
  id: string;
  business_id?: string;
  campaign_id?: string;
  campaign_job_id?: string;
  sender_id: string;
  csv_id?: string;
  segment_id?: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  status: EmailLogStatus;
  error_message?: string;
  tracking_id: string;
  opened_at?: string;
  clicked_at?: string;
  replied_at?: string;
  bounced_at?: string;
  timestamp: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  business_id: string;
  created_by: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

// ── AI ────────────────────────────────────────────────────────────────────────

export type AIProviderName = "groq" | "openai" | "claude";
export type AIOperation = "generate" | "humanize" | "subject" | "segment" | "score";

export interface AIResult {
  content: string | string[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  provider: AIProviderName;
  model: string;
  fallbackUsed: boolean;
  costUsd: number;
}

export interface GenerateEmailParams {
  brief: string;
  recipient: Record<string, any>;
  businessId: string;
  userId: string;
}

export interface HumanizeEmailParams {
  body: string;
  businessId: string;
  userId: string;
}

export interface GenerateSubjectsParams {
  body: string;
  count?: number;
  businessId: string;
  userId: string;
}

export interface SegmentContactsParams {
  rows: Record<string, any>[];
  columns: string[];
  businessId: string;
  userId: string;
}

// ── Queue Jobs ────────────────────────────────────────────────────────────────

export interface AttachmentRef {
  filename: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
}

export interface EmailJobData {
  jobType: "single" | "campaign_batch";
  businessId: string;
  campaignId?: string;
  campaignJobId?: string;
  senderId: string;
  adminId: string;
  recipientEmail: string;
  recipientData: Record<string, any>;
  subjectTemplate: string;
  bodyTemplate: string;
  senderOverride: boolean;
  attachments?: AttachmentRef[];
  priority: number;
  scheduledFor?: string;
  delayMs?: number;
  delayBetweenEmailsMs?: number;
}

export interface AIJobData {
  operation: AIOperation;
  params: Record<string, any>;
  businessId: string;
  userId: string;
  callbackJobId?: string;
}

export interface AnalyticsJobData {
  type: "hourly_rollup" | "daily_rollup" | "monthly_rollup";
  businessId?: string; // If undefined, process all businesses
  date: string; // ISO date string
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsSnapshot {
  business_id: string;
  snapshot_date: string;
  period: "daily" | "weekly" | "monthly";
  emails_sent: number;
  emails_failed: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  emails_bounced: number;
  ai_tokens_used: number;
  ai_cost_usd: number;
  active_senders: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

// ── Billing ───────────────────────────────────────────────────────────────────

export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "trialing";

export interface Subscription {
  id: string;
  business_id: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  plan: BusinessPlan;
  status: SubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
  emails_used: number;
  emails_limit: number;
  ai_tokens_used: number;
  ai_tokens_limit: number;
}

// ── Sender Policy ─────────────────────────────────────────────────────────────

export interface SenderPolicy {
  id: string;
  business_id: string;
  sender_id: string;
  admin_id: string;
  can_use_attachments: boolean;
  max_emails_per_day: number;
  allowed_file_types: string[];
  max_attachment_size_mb: number;
  can_override_dedup: boolean;
}

// ── Attachment Policy ─────────────────────────────────────────────────────────

export interface AttachmentPolicy {
  id: string;
  business_id: string;
  admin_id: string;
  attachments_enabled: boolean;
  allowed_mime_types: string[];
  max_size_mb: number;
  scan_enabled: boolean;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  businessId?: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}
