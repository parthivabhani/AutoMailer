/**
 * response.ts — Standard API response helpers
 *
 * Enforces a consistent response envelope across all endpoints:
 * {
 *   success: true,
 *   data: { ... },
 *   meta: { requestId, timestamp }
 * }
 *
 * Error responses follow:
 * {
 *   success: false,
 *   error: { code, message, details? }
 * }
 */

import type { Response } from "express";

// ── Response Envelope Types ───────────────────────────────────────────────────

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ── Success Helpers ───────────────────────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: SuccessResponse["meta"],
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  },
): void {
  sendSuccess(res, data, 200, {
    timestamp: new Date().toISOString(),
    ...pagination,
  });
}

// ── Error Helpers ─────────────────────────────────────────────────────────────

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
  res.status(statusCode).json(response);
}

export function sendNotFound(res: Response, resource: string): void {
  sendError(res, 404, "NOT_FOUND", `${resource} not found`);
}

export function sendUnauthorized(res: Response, message?: string): void {
  sendError(res, 401, "UNAUTHORIZED", message || "Authentication required");
}

export function sendForbidden(res: Response, message?: string): void {
  sendError(res, 403, "FORBIDDEN", message || "Insufficient permissions");
}

export function sendBadRequest(res: Response, message: string, details?: unknown): void {
  sendError(res, 400, "BAD_REQUEST", message, details);
}

export function sendInternalError(res: Response, message?: string): void {
  sendError(
    res,
    500,
    "INTERNAL_ERROR",
    message || "An unexpected error occurred. Please try again.",
  );
}
