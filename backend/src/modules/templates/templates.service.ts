/**
 * templates.service.ts — Reusable email template business logic
 */

import { templatesRepository } from "./templates.repository.js";
import { extractVariables } from "../../utils/interpolate.js";
import { AppError, NotFoundError } from "../../shared/errors.js";

export class TemplatesService {
  /**
   * Lists templates for a user.
   */
  async getTemplates(businessId: string, userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const { data, count } = await templatesRepository.listTemplates(businessId, userId, limit, offset);
    return {
      data,
      count,
      hasMore: offset + limit < count,
    };
  }

  /**
   * Creates a template, scanning variables from both subject and body.
   */
  async createTemplate(businessId: string, userId: string, payload: any) {
    const fullText = `${payload.subject} ${payload.body}`;
    const variables = extractVariables(fullText);

    return await templatesRepository.insert({
      business_id: businessId,
      created_by: userId,
      name: payload.name,
      subject: payload.subject,
      body: payload.body,
      variables,
      is_shared: payload.isShared,
    } as any);
  }

  /**
   * Retrieves template details.
   */
  async getTemplate(businessId: string, userId: string, role: string, templateId: string) {
    const template = await templatesRepository.findById(templateId, businessId);
    if (!template) {
      throw new NotFoundError("Template");
    }

    if (role === "sender" && template.created_by !== userId && !template.is_shared) {
      throw new NotFoundError("Template");
    }

    return template;
  }

  /**
   * Updates a template.
   */
  async updateTemplate(businessId: string, userId: string, role: string, templateId: string, payload: any) {
    const existing = await templatesRepository.findById(templateId, businessId);
    if (!existing) {
      throw new NotFoundError("Template");
    }

    if (role === "sender" && existing.created_by !== userId) {
      throw new AppError("You can only edit your own templates", 403, "FORBIDDEN");
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.name) updateData.name = payload.name;
    if (payload.subject) updateData.subject = payload.subject;
    if (payload.body) updateData.body = payload.body;
    if (payload.isShared !== undefined) updateData.is_shared = payload.isShared;

    if (payload.subject || payload.body) {
      const fullText = `${payload.subject || ""} ${payload.body || ""}`;
      updateData.variables = extractVariables(fullText);
    }

    return await templatesRepository.update(templateId, businessId, updateData);
  }

  /**
   * Deletes a template.
   */
  async deleteTemplate(businessId: string, userId: string, role: string, templateId: string) {
    const existing = await templatesRepository.findById(templateId, businessId);
    if (!existing) {
      throw new NotFoundError("Template");
    }

    if (role === "sender" && existing.created_by !== userId) {
      throw new AppError("You can only delete your own templates", 403, "FORBIDDEN");
    }

    await templatesRepository.delete(templateId, businessId);
    return { deleted: true };
  }
}

export const templatesService = new TemplatesService();
