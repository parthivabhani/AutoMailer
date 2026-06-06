/**
 * openai.provider.ts — OpenAI provider stub
 *
 * Full interface implementation ready for activation.
 * Set OPENAI_API_KEY and AI_DEFAULT_PROVIDER=openai to activate.
 *
 * TODO: Install openai package: npm install openai
 */

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

export class OpenAIProvider extends BaseAIProvider {
  readonly name = "openai";

  private _client: any | null = null; // TODO: Replace with OpenAI type

  private readonly DEFAULT_MODEL = "gpt-4o-mini";
  private readonly SMART_MODEL = "gpt-4o";

  isAvailable(): boolean {
    return !!getEnv().OPENAI_API_KEY;
  }

  private async getClient(): Promise<any> {
    if (this._client) return this._client;

    const apiKey = getEnv().OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    // Dynamic import to avoid requiring openai package when not used
    try {
      const { OpenAI } = await import("openai");
      this._client = new OpenAI({ apiKey });
      return this._client;
    } catch {
      throw new Error(
        'OpenAI package not installed. Run: npm install openai'
      );
    }
  }

  async generateEmail(params: GenerateEmailParams): Promise<AIResult> {
    const { brief, recipient } = params;
    const name = recipient.name || "there";
    const company = recipient.company || "their company";
    const title = recipient.title || "professional";
    const prompt = EMAIL_GENERATE_PROMPT({ brief, name, company, title });

    try {
      const client = await this.getClient();
      const response = await client.chat.completions.create({
        model: this.DEFAULT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      const usage = response.usage;

      return this.buildResult(
        content,
        this.DEFAULT_MODEL,
        usage?.prompt_tokens ?? 0,
        usage?.completion_tokens ?? 0
      );
    } catch (err) {
      logger.error({ err, provider: this.name }, "OpenAI generateEmail failed");
      throw err;
    }
  }

  async humanizeEmail(params: HumanizeEmailParams): Promise<AIResult> {
    const prompt = EMAIL_HUMANIZE_PROMPT({ body: params.body });

    try {
      const client = await this.getClient();
      const response = await client.chat.completions.create({
        model: this.DEFAULT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 350,
      });

      const content = response.choices[0]?.message?.content?.trim() || params.body;
      const usage = response.usage;

      return this.buildResult(
        content,
        this.DEFAULT_MODEL,
        usage?.prompt_tokens ?? 0,
        usage?.completion_tokens ?? 0
      );
    } catch (err) {
      logger.error({ err, provider: this.name }, "OpenAI humanizeEmail failed");
      throw err;
    }
  }

  async generateSubjects(params: GenerateSubjectsParams): Promise<AIResult> {
    const prompt = SUBJECT_GENERATE_PROMPT({ body: params.body, count: params.count || 5 });

    try {
      const client = await this.getClient();
      const response = await client.chat.completions.create({
        model: this.DEFAULT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 200,
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawContent);
      const subjects = parsed.subjects || parsed.suggestions || [];

      return this.buildResult(
        Array.isArray(subjects) ? subjects : [],
        this.DEFAULT_MODEL,
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0
      );
    } catch (err) {
      logger.error({ err, provider: this.name }, "OpenAI generateSubjects failed");
      throw err;
    }
  }

  async segmentContacts(params: SegmentContactsParams): Promise<AIResult> {
    const sampleRows = params.rows.slice(0, 15);
    const prompt = SEGMENTATION_PROMPT({ sampleRows });

    try {
      const client = await this.getClient();
      const response = await client.chat.completions.create({
        model: this.SMART_MODEL, // Use smarter model for segmentation
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawContent);
      const segments = parsed.segments || parsed.clusters || [];

      return this.buildResult(
        JSON.stringify(segments),
        this.SMART_MODEL,
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0
      );
    } catch (err) {
      logger.error({ err, provider: this.name }, "OpenAI segmentContacts failed");
      throw err;
    }
  }
}

export const openaiProvider = new OpenAIProvider();
