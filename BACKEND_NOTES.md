# Backend (placeholder)

This frontend is wired to a backend that the user will build separately.

## Stack

- Node.js + Express
- Supabase (Auth + Postgres + Storage)
- Nodemailer (SMTP via each admin's Google App Password)
- Groq API (segmentation + email generation/humanization/subject suggestions)

## Frontend integration contract

All requests go through `src/services/api.ts` using `axios` with base URL from
`VITE_API_BASE_URL`. Until the backend is up, calls return mocked responses
defined in the same file.

### Expected endpoints

Auth (Supabase Auth — handled client-side via the Supabase SDK, not via this REST layer):
- `profiles` table joined to `auth.users` with column `role` ∈ `super_admin | admin | sender`

Super Admin:
- `GET    /super-admin/admins`
- `PATCH  /super-admin/admins/:id/status`         { status }
- `GET    /super-admin/stats`

Admin:
- `GET    /admin/stats`
- `GET    /admin/senders`
- `POST   /admin/senders`                          { name, email, password }
- `DELETE /admin/senders/:id`
- `GET    /admin/csv`
- `POST   /admin/csv`                              multipart upload OR { name, columns, rows }
- `POST   /admin/csv/:id/segment`                  → Groq segmentation, returns segments[]
- `POST   /admin/csv/:id/assign`                   { senderId, segmentId? }
- `GET    /admin/logs`                             ?senderId=&from=&to=
- `POST   /admin/smtp`                             { gmail, appPassword }   (store encrypted)

Sender:
- `GET    /sender/assigned`
- `POST   /ai/generate`                            { brief, recipient } → string
- `POST   /ai/humanize`                            { body } → string
- `POST   /ai/subjects`                            { body } → string[]
- `POST   /send`                                   { csvId, segmentId?, subject, body, recipientIds[] }
  - Server interpolates `{name}`, `{company}`, etc. per recipient from CSV
  - Server checks dedup table to skip already-emailed recipients
  - Server writes one row to `email_logs` per attempt

## .env (backend)

```
PORT=4000
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GROQ_API_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
ENCRYPTION_KEY=...   # for encrypting per-admin app passwords at rest
```

## Frontend .env

```
VITE_API_BASE_URL=http://localhost:4000
```
