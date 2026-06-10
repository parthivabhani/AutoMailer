/**
 * auditLog.ts — Structured audit trail middleware
 *
 * Logs every state-changing operation to the audit_logs table.
 * Apply selectively to sensitive endpoints.
 *
 * Usage:
 *   router.delete("/senders/:id", audit("sender.deleted"), handler)
 *   router.post("/smtp", audit("smtp.configured"), handler)
 */

import type { Request, Response, NextFunction } from "express";
import { getSupabaseAdmin } from "../config/supabase.js";
import type { AuthenticatedRequest } from "../shared/types.js";
import { auditLogger } from "../shared/logger.js";

// ── Middleware Factory ────────────────────────────────────────────────────────

export function audit(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    // Intercept the response to capture the resource ID from the response body
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Only log if the request succeeded (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && authReq.user) {
        const entry = {
          business_id: authReq.user.businessId || null,
          user_id: authReq.user.userId,
          action,
          resource_type: req.path.split("/")[1] || null,
          resource_id: body?.id || req.params.id || null,
          metadata: {
            method: req.method,
            path: req.path,
            body: sanitizeForAudit(req.body),
          },
          ip_address: req.ip || null,
          user_agent: req.headers["user-agent"] || null,
        };

        // Fire-and-forget — don't block the response
        const insertPromise = getSupabaseAdmin().from("audit_logs").insert(entry);
        Promise.resolve(insertPromise).catch((err: any) =>
          auditLogger.error({ err, action }, "Failed to write audit log"),
        );

        auditLogger.info(entry, `Audit: ${action}`);
      }

      return originalJson(body);
    };

    next();
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Remove sensitive fields before storing in audit log metadata */
function sanitizeForAudit(body: Record<string, any>): Record<string, any> {
  if (!body || typeof body !== "object") return {};

  const SENSITIVE_FIELDS = [
    "password",
    "app_password",
    "appPassword",
    "secret",
    "apiKey",
    "token",
    "encrypted_password",
    "stripe_key",
  ];

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      cleaned[key] = "[REDACTED]";
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
