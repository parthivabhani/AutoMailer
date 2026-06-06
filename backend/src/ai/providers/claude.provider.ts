/**
 * claude.provider.ts — Anthropic Claude provider stub
 *
 * Full interface implementation ready for activation.
 * Set ANTHROPIC_API_KEY and AI_DEFAULT_PROVIDER=claude to activate.
 *
 * TODO: Install anthropic package: npm install @anthropic-ai/sdk
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

export class ClaudeProvider extends BaseAIProvider {
  readonly name = "claude";

  private _client: any | null = null;

  private readonly DEFAULT_MODEL = "claude-3-haiku-20240307"; // Fast + cheap
  private readonly SMART_MODEL = "claude-3-5-sonnet-20241022"; // Higher quality

  isAvailable(): boolean {
    return !!getEnv().ANTHROPIC_API_KEY;
  }

  private async getClient(): Promise<any> {
    if (this._client) return this._client;

    const apiKey = getEnv().ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    try {
      const Anthropic = await import("@anthropic-ai/sdk");
      this._client = new Anthropic.default({ apiKey });
      return this._client;
    } catch {
      throw new Error(
        'Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk'
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
      const response = await client.messages.create({
        model: this.DEFAULT_MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : "";

      return this.buildResult(
        content,
        this.DEFAULT_MODEL,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
    } catch (err) {
      logger.error({ err, provider: this.name }, "Claude generateEmail failed");
      throw err;
    }
  }

  async humanizeEmail(params: HumanizeEmailParams): Promise<AIResult> {
    const prompt = EMAIL_HUMANIZE_PROMPT({ body: params.body });

    try {
      const client = await this.getClient();
      const response = await client.messages.create({
        model: this.DEFAULT_MODEL,
        max_tokens: 350,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : params.body;

      return this.buildResult(
        content,
        this.DEFAULT_MODEL,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
    } catch (err) {
      logger.error({ err, provider: this.name }, "Claude humanizeEmail failed");
      throw err;
    }
  }

  async generateSubjects(params: GenerateSubjectsParams): Promise<AIResult> {
    const prompt = SUBJECT_GENERATE_PROMPT({ body: params.body, count: params.count || 5 });

    try {
      const client = await this.getClient();
      const response = await client.messages.create({
        model: this.DEFAULT_MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });

      const rawContent = response.content[0]?.type === "text" ? response.content[0].text : "[]";

      let subjects: string[] = [];
      try {
        const parsed = JSON.parse(rawContent);
        subjects = parsed.subjects || parsed.suggestions || parsed;
      } catch {
        // If not JSON, split by newlines
        subjects = rawContent.split("\n").filter(Boolean).slice(0, params.count || 5);
      }

      return this.buildResult(
        Array.isArray(subjects) ? subjects : [],
        this.DEFAULT_MODEL,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
    } catch (err) {
      logger.error({ err, provider: this.name }, "Claude generateSubjects failed");
      throw err;
    }
  }

  async segmentContacts(params: SegmentContactsParams): Promise<AIResult> {
    const sampleRows = params.rows.slice(0, 15);
    const prompt = SEGMENTATION_PROMPT({ sampleRows });

    try {
      const client = await this.getClient();
      const response = await client.messages.create({
        model: this.SMART_MODEL,
        max_tokens: 1_024,
        messages: [{ role: "user", content: prompt }],
      });

      const rawContent = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      const parsed = JSON.parse(rawContent);
      const segments = parsed.segments || parsed.clusters || [];

      return this.buildResult(
        JSON.stringify(segments),
        this.SMART_MODEL,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
    } catch (err) {
      logger.error({ err, provider: this.name }, "Claude segmentContacts failed");
      throw err;
    }
  }
}

export const claudeProvider = new ClaudeProvider();
