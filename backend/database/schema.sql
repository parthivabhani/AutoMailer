-- ============================================================
-- AutoMailer Enterprise — Complete Database Schema Migration
-- Version: 2.0.0
-- Run in Supabase SQL Editor
-- ============================================================
-- IMPORTANT: Run sections in ORDER. Each section depends on the previous.
-- This migration is additive — it does NOT drop existing tables.
-- ============================================================


-- ============================================================
-- SECTION 1: BUSINESSES TABLE (new tenant container)
-- ============================================================

CREATE TABLE IF NOT EXISTS businesses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  plan                  TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free', 'starter', 'growth', 'enterprise')),
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'trial')),
  max_senders           INT NOT NULL DEFAULT 3,
  max_emails_per_month  INT NOT NULL DEFAULT 500,
  stripe_customer_id    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_at          TIMESTAMPTZ,
  suspended_reason      TEXT
);

CREATE INDEX IF NOT EXISTS idx_businesses_status     ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_plan       ON businesses(plan);
CREATE INDEX IF NOT EXISTS idx_businesses_stripe     ON businesses(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================
-- SECTION 2: ENHANCE EXISTING PROFILES TABLE
-- ============================================================

-- Add columns to existing profiles table
-- (using IF NOT EXISTS pattern for idempotency)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'suspended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE profiles ADD COLUMN permissions JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_active_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_business_id  ON profiles(business_id)
  WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role          ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_admin_id      ON profiles(admin_id)
  WHERE admin_id IS NOT NULL;

-- ============================================================
-- SECTION 3: CAMPAIGNS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  admin_id                 UUID NOT NULL REFERENCES profiles(id),
  name                     TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','scheduled','sending','paused','completed','cancelled')),
  subject_template         TEXT NOT NULL,
  body_template            TEXT NOT NULL,
  scheduled_at             TIMESTAMPTZ,
  timezone                 TEXT DEFAULT 'UTC',
  delay_between_emails_ms  INT DEFAULT 300 CHECK (delay_between_emails_ms >= 200),
  sender_override          BOOLEAN DEFAULT FALSE,
  batch_size               INT DEFAULT 50 CHECK (batch_size >= 1),
  priority                 INT DEFAULT 0 CHECK (priority BETWEEN 0 AND 10),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at               TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  paused_at                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_business    ON campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_admin       ON campaigns(admin_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status      ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled   ON campaigns(scheduled_at)
  WHERE status = 'scheduled';

-- ============================================================
-- SECTION 4: CAMPAIGN JOBS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS campaign_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  business_id      UUID NOT NULL REFERENCES businesses(id),
  sender_id        UUID NOT NULL REFERENCES profiles(id),
  recipient_email  TEXT NOT NULL,
  recipient_data   JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','sent','failed','skipped','cancelled')),
  priority         INT DEFAULT 0,
  bullmq_job_id    TEXT,
  attempts         INT DEFAULT 0,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaign_jobs_campaign  ON campaign_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_status    ON campaign_jobs(status);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_sender    ON campaign_jobs(sender_id);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_business  ON campaign_jobs(business_id);

-- ============================================================
-- SECTION 5: CONTACTS TABLE (normalized contact store)
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  csv_id       UUID REFERENCES csv_files(id) ON DELETE SET NULL,
  email        TEXT NOT NULL,
  name         TEXT,
  company      TEXT,
  title        TEXT,
  data         JSONB DEFAULT '{}',
  is_vip       BOOLEAN DEFAULT FALSE,
  vip_score    INT DEFAULT 0 CHECK (vip_score BETWEEN 0 AND 100),
  tags         TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_business_email  ON contacts(business_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_vip                    ON contacts(business_id, is_vip, vip_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_tags                   ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_business               ON contacts(business_id);

-- ============================================================
-- SECTION 6: CONTACT DEDUPLICATION TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_dedup (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id      UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  recipient_email  TEXT NOT NULL,
  sender_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  cooldown_until   TIMESTAMPTZ  -- NULL = permanent dedup
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dedup_business_email  ON contact_dedup(business_id, recipient_email);
CREATE INDEX IF NOT EXISTS idx_dedup_cooldown               ON contact_dedup(cooldown_until)
  WHERE cooldown_until IS NOT NULL;

-- ============================================================
-- SECTION 7: ENHANCE EXISTING EMAIL_LOGS TABLE
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN business_id UUID REFERENCES businesses(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN campaign_id UUID REFERENCES campaigns(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'campaign_job_id'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN campaign_job_id UUID REFERENCES campaign_jobs(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'opened_at'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN opened_at TIMESTAMPTZ;
    ALTER TABLE email_logs ADD COLUMN clicked_at TIMESTAMPTZ;
    ALTER TABLE email_logs ADD COLUMN replied_at TIMESTAMPTZ;
    ALTER TABLE email_logs ADD COLUMN bounced_at TIMESTAMPTZ;
    ALTER TABLE email_logs ADD COLUMN tracking_id UUID DEFAULT gen_random_uuid();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_logs_business   ON email_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign   ON email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_tracking   ON email_logs(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_timestamp  ON email_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status     ON email_logs(status);

-- ============================================================
-- SECTION 8: AI USAGE TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_usage (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES profiles(id),
  provider           TEXT NOT NULL CHECK (provider IN ('groq', 'openai', 'claude')),
  model              TEXT NOT NULL,
  operation          TEXT NOT NULL
                     CHECK (operation IN ('generate','humanize','subject','segment','score')),
  prompt_tokens      INT NOT NULL DEFAULT 0,
  completion_tokens  INT NOT NULL DEFAULT 0,
  total_tokens       INT NOT NULL DEFAULT 0,
  cost_usd           DECIMAL(10, 6) DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_business   ON ai_usage(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user       ON ai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider   ON ai_usage(provider, created_at DESC);

-- ============================================================
-- SECTION 9: SENDER POLICIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS sender_policies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sender_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id                UUID NOT NULL REFERENCES profiles(id),
  can_use_attachments     BOOLEAN DEFAULT FALSE,
  max_emails_per_day      INT DEFAULT 500,
  allowed_file_types      TEXT[] DEFAULT '{}',
  max_attachment_size_mb  INT DEFAULT 10,
  can_override_dedup      BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sender_id)
);

CREATE INDEX IF NOT EXISTS idx_sender_policies_business  ON sender_policies(business_id);
CREATE INDEX IF NOT EXISTS idx_sender_policies_sender    ON sender_policies(sender_id);

-- ============================================================
-- SECTION 10: ATTACHMENT POLICIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS attachment_policies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  admin_id            UUID NOT NULL REFERENCES profiles(id),
  attachments_enabled BOOLEAN DEFAULT FALSE,
  allowed_mime_types  TEXT[] DEFAULT ARRAY['application/pdf'],
  max_size_mb         INT DEFAULT 10,
  scan_enabled        BOOLEAN DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 11: TEMPLATES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  name         TEXT NOT NULL,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  variables    TEXT[] DEFAULT '{}',
  is_shared    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_business    ON templates(business_id);
CREATE INDEX IF NOT EXISTS idx_templates_created_by  ON templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_shared      ON templates(business_id, is_shared)
  WHERE is_shared = TRUE;

-- ============================================================
-- SECTION 12: SUBSCRIPTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  stripe_subscription_id   TEXT,
  stripe_price_id          TEXT,
  plan                     TEXT NOT NULL DEFAULT 'free',
  status                   TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','past_due','cancelled','trialing')),
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  emails_used              INT DEFAULT 0,
  emails_limit             INT DEFAULT 500,
  ai_tokens_used           INT DEFAULT 0,
  ai_tokens_limit          INT DEFAULT 10000,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe  ON subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);

-- ============================================================
-- SECTION 13: BILLING HISTORY TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id),
  stripe_invoice_id TEXT,
  amount_cents      INT NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'usd',
  status            TEXT NOT NULL CHECK (status IN ('paid','failed','refunded')),
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_history_business  ON billing_history(business_id, created_at DESC);

-- ============================================================
-- SECTION 14: SCHEDULED JOBS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id      UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  job_type         TEXT NOT NULL
                   CHECK (job_type IN ('send_campaign','analytics_rollup','bounce_process')),
  cron_expression  TEXT,   -- NULL = one-shot
  next_run_at      TIMESTAMPTZ NOT NULL,
  last_run_at      TIMESTAMPTZ,
  bullmq_job_id    TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','completed','cancelled')),
  payload          JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run  ON scheduled_jobs(next_run_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_business  ON scheduled_jobs(business_id);

-- ============================================================
-- SECTION 15: ANALYTICS SNAPSHOTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID REFERENCES businesses(id) ON DELETE CASCADE,  -- NULL = platform-wide
  snapshot_date    DATE NOT NULL,
  period           TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly')),
  emails_sent      INT DEFAULT 0,
  emails_failed    INT DEFAULT 0,
  emails_opened    INT DEFAULT 0,
  emails_clicked   INT DEFAULT 0,
  emails_replied   INT DEFAULT 0,
  emails_bounced   INT DEFAULT 0,
  ai_tokens_used   INT DEFAULT 0,
  ai_cost_usd      DECIMAL(10, 4) DEFAULT 0,
  active_senders   INT DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, snapshot_date, period)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_business_date
  ON analytics_snapshots(business_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_period
  ON analytics_snapshots(period, snapshot_date DESC);

-- ============================================================
-- SECTION 16: AUDIT LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID REFERENCES businesses(id),
  user_id        UUID REFERENCES profiles(id),
  action         TEXT NOT NULL,
  resource_type  TEXT,
  resource_id    TEXT,
  metadata       JSONB DEFAULT '{}',
  ip_address     TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business  ON audit_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user      ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON audit_logs(action, created_at DESC);

-- ============================================================
-- SECTION 17: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- Note: These policies assume you run queries with the service role
-- key on the backend (bypasses RLS) and use anon key only for
-- Supabase Auth verification.

-- Enable RLS on sensitive tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can read everything
CREATE POLICY IF NOT EXISTS "super_admin_all_businesses"
  ON businesses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Admins can only read their own business
CREATE POLICY IF NOT EXISTS "admin_own_business"
  ON businesses FOR SELECT
  USING (
    id IN (
      SELECT business_id FROM profiles WHERE profiles.id = auth.uid()
    )
  );

-- Users can only read their own profile
CREATE POLICY IF NOT EXISTS "users_own_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can read profiles in their business
CREATE POLICY IF NOT EXISTS "admin_business_profiles"
  ON profiles FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Campaign access scoped to business
CREATE POLICY IF NOT EXISTS "campaigns_business_scope"
  ON campaigns FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Email logs scoped to business
CREATE POLICY IF NOT EXISTS "email_logs_business_scope"
  ON email_logs FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- SECTION 18: HELPFUL VIEWS
-- ============================================================

-- Campaign summary view for dashboards
CREATE OR REPLACE VIEW campaign_summaries AS
SELECT
  c.id,
  c.business_id,
  c.admin_id,
  c.name,
  c.status,
  c.created_at,
  c.started_at,
  c.completed_at,
  COUNT(cj.id) AS total_jobs,
  COUNT(cj.id) FILTER (WHERE cj.status = 'sent') AS sent_count,
  COUNT(cj.id) FILTER (WHERE cj.status = 'failed') AS failed_count,
  COUNT(cj.id) FILTER (WHERE cj.status = 'skipped') AS skipped_count,
  COUNT(cj.id) FILTER (WHERE cj.status = 'pending') AS pending_count
FROM campaigns c
LEFT JOIN campaign_jobs cj ON cj.campaign_id = c.id
GROUP BY c.id, c.business_id, c.admin_id, c.name, c.status, c.created_at, c.started_at, c.completed_at;

-- Platform-wide metrics view for super admin
CREATE OR REPLACE VIEW platform_metrics AS
SELECT
  COUNT(DISTINCT b.id) AS total_businesses,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active') AS active_businesses,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'suspended') AS suspended_businesses,
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'admin') AS total_admins,
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'sender') AS total_senders,
  COUNT(DISTINCT el.id) AS total_emails_all_time,
  COUNT(DISTINCT el.id) FILTER (WHERE el.status = 'sent') AS total_sent,
  COUNT(DISTINCT el.id) FILTER (WHERE el.status = 'failed') AS total_failed,
  SUM(au.total_tokens) AS total_ai_tokens_used,
  SUM(au.cost_usd) AS total_ai_cost_usd
FROM businesses b
LEFT JOIN profiles p ON p.business_id = b.id
LEFT JOIN email_logs el ON el.business_id = b.id
LEFT JOIN ai_usage au ON au.business_id = b.id;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Next steps:
-- 1. Run: npx supabase gen types typescript to regenerate types
-- 2. Update config/supabase.ts Database type import
-- 3. Test all existing endpoints still work
-- ============================================================
