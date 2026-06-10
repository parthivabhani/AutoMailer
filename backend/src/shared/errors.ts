/**
 * errors.ts — Typed AppError class hierarchy
 *
 * Structured error types that carry HTTP status codes and error codes.
 * The global error handler in app.ts uses these to produce consistent
 * API error responses.
 */

// ── Base Application Error ────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Operational errors are expected; programmer errors are not
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── HTTP 400 — Bad Request ────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

// ── HTTP 401 — Unauthorized ───────────────────────────────────────────────────

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class InvalidTokenError extends AppError {
  constructor(message: string = "Invalid or expired token") {
    super(message, 401, "INVALID_TOKEN");
  }
}

// ── HTTP 403 — Forbidden ──────────────────────────────────────────────────────

export class ForbiddenError extends AppError {
  constructor(message: string = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
  }
}

export class InsufficientPermissionsError extends AppError {
  constructor(permission: string) {
    super(`Insufficient permissions: requires '${permission}'`, 403, "INSUFFICIENT_PERMISSIONS", {
      required: permission,
    });
  }
}

export class TenantIsolationError extends AppError {
  constructor() {
    super("Cross-tenant access denied", 403, "TENANT_ISOLATION_VIOLATION");
  }
}

// ── HTTP 404 — Not Found ──────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with ID '${id}' not found` : `${resource} not found`,
      404,
      "NOT_FOUND",
      { resource, id },
    );
  }
}

// ── HTTP 409 — Conflict ───────────────────────────────────────────────────────

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

// ── HTTP 422 — Unprocessable ──────────────────────────────────────────────────

export class UnprocessableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "UNPROCESSABLE", details);
  }
}

// ── HTTP 429 — Rate Limited ───────────────────────────────────────────────────

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests. Please slow down.") {
    super(message, 429, "RATE_LIMITED");
  }
}

// ── HTTP 402 — Payment Required ───────────────────────────────────────────────

export class PlanLimitError extends AppError {
  constructor(limit: string, current: number, max: number) {
    super(
      `Plan limit reached for ${limit}. Current: ${current}, Limit: ${max}. Please upgrade your plan.`,
      402,
      "PLAN_LIMIT_EXCEEDED",
      { limit, current, max },
    );
  }
}

// ── HTTP 503 — Service Unavailable ───────────────────────────────────────────

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`Service temporarily unavailable: ${service}`, 503, "SERVICE_UNAVAILABLE");
  }
}

// ── Domain-Specific Errors ────────────────────────────────────────────────────

export class SMTPNotConfiguredError extends AppError {
  constructor() {
    super(
      "SMTP is not configured for this account. Please configure SMTP before sending campaigns.",
      400,
      "SMTP_NOT_CONFIGURED",
    );
  }
}

export class CampaignAlreadySendingError extends AppError {
  constructor(campaignId: string) {
    super(
      `Campaign '${campaignId}' is already sending. Pause it first to make changes.`,
      409,
      "CAMPAIGN_ALREADY_SENDING",
    );
  }
}

export class AttachmentPolicyViolationError extends AppError {
  constructor(reason: string) {
    super(`Attachment policy violation: ${reason}`, 400, "ATTACHMENT_POLICY_VIOLATION");
  }
}

export class AIProviderError extends AppError {
  constructor(provider: string, message: string) {
    super(`AI provider '${provider}' error: ${message}`, 502, "AI_PROVIDER_ERROR");
  }
}

export class DeduplicationError extends AppError {
  constructor(email: string, cooldownUntil?: string) {
    super(
      `Recipient '${email}' is within the deduplication cooldown period${
        cooldownUntil ? ` until ${cooldownUntil}` : ""
      }.`,
      409,
      "DEDUP_COOLDOWN",
      { email, cooldownUntil },
    );
  }
}

// ── Type Guard ────────────────────────────────────────────────────────────────

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function isOperationalError(err: unknown): boolean {
  return isAppError(err) && err.isOperational;
}
