/**
 * groq.provider.ts — Groq AI provider implementation
 *
 * Migrates the existing Groq implementation from routes/ai.ts into
 * a proper provider class. Preserves the existing prompts and
 * fallback logic while adding token tracking and structured results.
 */

import Groq from "groq-sdk";
import { BaseAIProvider } from "../ai.provider.js";
import type { AIResult, GenerateEmailParams, HumanizeEmailParams, GenerateSubjectsParams, SegmentContactsParams } from "../../shared/types.js";
import { getEnv } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import {
  EMAIL_GENERATE_PROMPT,
  EMAIL_HUMANIZE_PROMPT,
  SUBJECT_GENERATE_PROMPT,
  SEGMENTATION_PROMPT,
} from "../prompts/index.js";

export class GroqProvider extends BaseAIProvider {
  readonly name = "groq";

  private _client: Groq | null = null;

  private readonly FAST_MODEL = "llama-3.1-8b-instant";
  private readonly SMART_MODEL = "llama-3.3-70b-versatile";

  isAvailable(): boolean {
    return !!getEnv().GROQ_API_KEY;
  }

  private getClient(): Groq {
    if (this._client) return this._client;
    const apiKey = getEnv().GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
    this._client = new Groq({ apiKey });
    return this._client;
  }

  async generateEmail(params: GenerateEmailParams): Promise<AIResult> {
    const { brief, recipient } = params;

    const name = recipient.name || recipient.Name || recipient.FirstName || "there";
    const company = recipient.company || recipient.Company || "their company";
    const title = recipient.title || recipient.Title || recipient.Role || "professional";

    const prompt = EMAIL_GENERATE_PROMPT({ brief, name, company, title });

    try {
      const response = await this.getClient().chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: this.FAST_MODEL,
        temperature: 0.7,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      const usage = response.usage;

      return this.buildResult(
        content,
        this.FAST_MODEL,
        usage?.prompt_tokens ?? 0,
        usage?.completion_tokens ?? 0
      );
    } catch (err) {
      logger.error({ err, provider: this.name, operation: "generateEmail" }, "Groq generateEmail failed");
      throw err;
    }
  }

  async humanizeEmail(params: HumanizeEmailParams): Promise<AIResult> {
    const { body } = params;
    const prompt = EMAIL_HUMANIZE_PROMPT({ body });

    try {
      const response = await this.getClient().chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: this.FAST_MODEL,
        temperature: 0.5,
        max_tokens: 350,
      });

      const content = response.choices[0]?.message?.content?.trim() || body;
      const usage = response.usage;

      return this.buildResult(
        content,
        this.FAST_MODEL,
        usage?.prompt_tokens ?? 0,
        usage?.completion_tokens ?? 0
      );
    } catch (err) {
      logger.error({ err, provider: this.name, operation: "humanizeEmail" }, "Groq humanizeEmail failed");
      throw err;
    }
  }

  async generateSubjects(params: GenerateSubjectsParams): Promise<AIResult> {
    const { body, count = 5 } = params;
    const prompt = SUBJECT_GENERATE_PROMPT({ body, count });

    try {
      const response = await this.getClient().chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: this.FAST_MODEL,
        temperature: 0.8,
        max_tokens: 200,
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawContent);
      const subjects: string[] = parsed.subjects || parsed.suggestions || parsed;

      const usage = response.usage;

      return this.buildResult(
        Array.isArray(subjects) ? subjects : [],
        this.FAST_MODEL,
        usage?.prompt_tokens ?? 0,
        usage?.completion_tokens ?? 0
      );
    } catch (err) {
      logger.error({ err, provider: this.name, operation: "generateSubjects" }, "Groq generateSubjects failed");
      throw err;
    }
  }

  async segmentContacts(params: SegmentContactsParams): Promise<AIResult> {
    const { rows, columns } = params;

    // Use smart model for segmentation since it requires better reasoning
    const sampleRows = rows.slice(0, 15).map((r) => {
      const simplified: Record<string, any> = {};
      columns.forEach((c) => {
        if (/company|industry|role|title|segment|category/i.test(c)) {
          simplified[c] = r[c];
        }
      });
      if (Object.keys(simplified).length === 0) {
        columns.slice(0, 3).forEach((c) => (simplified[c] = r[c]));
      }
      simplified._id = r._id;
      return simplified;
    });

    const prompt = SEGMENTATION_PROMPT({ sampleRows });

    try {
      const response = await this.getClient().chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: this.FAST_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawContent);
      const segments = parsed.segments || parsed.clusters || parsed;

      const usage = response.usage;

      return this.buildResult(
        JSON.stringify(Array.isArray(segments) ? segments : []),
        this.FAST_MODEL,
        usage?.prompt_tokens ?? 0,
        usage?.completion_tokens ?? 0
      );
    } catch (err) {
      logger.error({ err, provider: this.name, operation: "segmentContacts" }, "Groq segmentContacts failed");
      throw err;
    }
  }
}

// Export singleton
export const groqProvider = new GroqProvider();
