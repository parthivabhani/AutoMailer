/**
 * attachmentPolicy.ts — Attachment validation middleware
 *
 * Enforces admin-configured attachment restrictions:
 * - Whether attachments are allowed at all
 * - Allowed MIME types
 * - Maximum file size
 * - Dangerous extension blocking
 *
 * TODO: Add virus scanning integration (ClamAV or VirusTotal API)
 */

import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../shared/types.js";
import { AttachmentPolicyViolationError, ForbiddenError } from "../shared/errors.js";
import { getSupabase } from "../config/supabase.js";
import { ATTACHMENT_CONFIG } from "../config/constants.js";

// ── Attachment Validation Middleware ──────────────────────────────────────────

/**
 * Validates uploaded files against the business's attachment policy.
 * Apply to any route that accepts file uploads.
 *
 * Expects multer or similar to have already parsed the files into req.files.
 */
export async function enforceAttachmentPolicy(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user?.businessId) {
    return next(new ForbiddenError("Tenant context required for attachment uploads"));
  }

  // If no files are attached, skip validation
  const files = req.files;
  if (!files || (Array.isArray(files) && files.length === 0)) {
    return next();
  }

  try {
    // 1. Fetch business attachment policy
    const { data: policy } = await getSupabase()
      .from("attachment_policies")
      .select("*")
      .eq("business_id", authReq.user.businessId)
      .single();

    // 2. If no policy, apply defaults (attachments disabled)
    const attachmentsEnabled = policy?.attachments_enabled ?? false;

    if (!attachmentsEnabled) {
      return next(
        new AttachmentPolicyViolationError(
          "Attachments are disabled for your organization. Contact your administrator."
        )
      );
    }

    // 3. Check per-sender policy if user is a sender
    if (authReq.user.role === "sender") {
      const { data: senderPolicy } = await getSupabase()
        .from("sender_policies")
        .select("can_use_attachments, allowed_file_types, max_attachment_size_mb")
        .eq("sender_id", authReq.user.userId)
        .single();

      if (!senderPolicy?.can_use_attachments) {
        return next(
          new AttachmentPolicyViolationError(
            "You are not permitted to send attachments. Contact your administrator."
          )
        );
      }
    }

    // 4. Validate each file
    const allowedMimeTypes: string[] = policy?.allowed_mime_types || ATTACHMENT_CONFIG.ALLOWED_MIME_TYPES;
    const maxSizeBytes = (policy?.max_size_mb || ATTACHMENT_CONFIG.DEFAULT_MAX_SIZE_MB) * 1024 * 1024;
    const fileList = Array.isArray(files) ? files : Object.values(files).flat();

    for (const file of fileList as Express.Multer.File[]) {
      // Check dangerous extensions
      const ext = `.${file.originalname.split(".").pop()?.toLowerCase()}`;
      if (ATTACHMENT_CONFIG.DANGEROUS_EXTENSIONS.includes(ext as any)) {
        return next(
          new AttachmentPolicyViolationError(
            `File type '${ext}' is not allowed for security reasons.`
          )
        );
      }

      // Check MIME type
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return next(
          new AttachmentPolicyViolationError(
            `MIME type '${file.mimetype}' is not permitted. Allowed: ${allowedMimeTypes.join(", ")}`
          )
        );
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        const maxMb = maxSizeBytes / 1024 / 1024;
        return next(
          new AttachmentPolicyViolationError(
            `File '${file.originalname}' exceeds the maximum size of ${maxMb}MB.`
          )
        );
      }
    }

    // TODO: Integrate virus scanning here
    // if (env.FEATURE_ATTACHMENT_SCAN) {
    //   await scanFilesForViruses(fileList);
    // }

    next();
  } catch (err) {
    next(err);
  }
}
