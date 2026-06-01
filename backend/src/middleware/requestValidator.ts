/**
 * requestValidator.ts — Zod schema request validation middleware
 *
 * Usage:
 *   import { validate } from "../middleware/requestValidator";
 *   import { z } from "zod";
 *
 *   const schema = z.object({
 *     body: z.object({ email: z.string().email(), name: z.string().min(1) })
 *   });
 *
 *   router.post("/senders", validate(schema), handler);
 */

import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod";
import { ValidationError } from "../shared/errors.js";

// ── Validation Target ─────────────────────────────────────────────────────────

interface ValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

// ── Middleware Factory ────────────────────────────────────────────────────────

export function validate(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errors.push(`body.${issue.path.join(".")}: ${issue.message}`);
        });
      } else {
        req.body = result.data; // Replace with parsed/coerced data
      }
    }

    // Validate query params
    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errors.push(`query.${issue.path.join(".")}: ${issue.message}`);
        });
      } else {
        req.query = result.data as any;
      }
    }

    // Validate route params
    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errors.push(`params.${issue.path.join(".")}: ${issue.message}`);
        });
      } else {
        req.params = result.data as any;
      }
    }

    if (errors.length > 0) {
      return next(
        new ValidationError("Request validation failed", { errors })
      );
    }

    next();
  };
}

// ── Common Reusable Schemas ───────────────────────────────────────────────────

export const UUIDSchema = z.string().uuid("Must be a valid UUID");

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const IdParamSchema = z.object({
  id: UUIDSchema,
});
