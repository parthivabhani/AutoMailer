-- ============================================================
-- AutoMailer Enterprise — Development Seed Data
-- Run in Supabase SQL Editor to populate test records
-- ============================================================

-- 1. Create a Seed Business
INSERT INTO businesses (id, name, slug, plan, status, max_senders, max_emails_per_month)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Acme B2B Outreach Corp',
  'acme-outreach',
  'growth',
  'active',
  5,
  10000
) ON CONFLICT (slug) DO NOTHING;

-- 2. Create sample admin and sender profiles
-- Note: Replace these UUIDs with real auth.users IDs if integrating with Supabase Auth
INSERT INTO profiles (id, business_id, email, name, role, status, permissions)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'admin@acme.com',
  'Alice Administrator',
  'admin',
  'active',
  '{}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, business_id, admin_id, email, name, role, status, permissions)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'sender@acme.com',
  'Sam Sender',
  'sender',
  'active',
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- 3. Create active subscription
INSERT INTO subscriptions (business_id, plan, status, emails_used, emails_limit, ai_tokens_used, ai_tokens_limit)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'growth',
  'active',
  150,
  10000,
  5000,
  100000
) ON CONFLICT (business_id) DO NOTHING;

-- 4. Create sample templates
INSERT INTO templates (id, business_id, created_by, name, subject, body, variables, is_shared)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Cold Pitch v1',
  'Quick question for {Name} regarding {Company}',
  'Hi {Name},\n\nI noticed your role as {Title} at {Company}.\n\nWe recently helped a similar company scale their outreach pipeline by 3x using automated workflows. I''d love to know if you are open to a brief 5-minute chat next Tuesday?\n\nBest,\nSam',
  ARRAY['Name', 'Company', 'Title'],
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- 5. Create some sample contacts
INSERT INTO contacts (id, business_id, email, name, company, title, is_vip, vip_score, tags)
VALUES 
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'elon@tesla.com', 'Elon Musk', 'Tesla', 'CEO', TRUE, 95, ARRAY['tech', 'automotive']),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'satya@microsoft.com', 'Satya Nadella', 'Microsoft', 'CEO', TRUE, 90, ARRAY['enterprise', 'cloud']),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'sundar@google.com', 'Sundar Pichai', 'Google', 'CEO', TRUE, 92, ARRAY['search', 'ai'])
ON CONFLICT (business_id, email) DO NOTHING;

-- 6. Setup default sender policy for the sender
INSERT INTO sender_policies (business_id, sender_id, admin_id, can_use_attachments, max_emails_per_day, allowed_file_types, max_attachment_size_mb, can_override_dedup)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  TRUE,
  500,
  ARRAY['pdf', 'docx'],
  10,
  FALSE
) ON CONFLICT (sender_id) DO NOTHING;

-- 7. Add daily analytics snapshot for yesterday and today
INSERT INTO analytics_snapshots (business_id, snapshot_date, period, emails_sent, emails_failed, emails_opened, emails_clicked, emails_replied, emails_bounced, ai_tokens_used, ai_cost_usd, active_senders)
VALUES 
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, 'daily', 50, 2, 25, 10, 5, 0, 1200, 0.0024, 1),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE, 'daily', 75, 1, 30, 15, 8, 1, 2300, 0.0046, 1)
ON CONFLICT (business_id, snapshot_date, period) DO NOTHING;
