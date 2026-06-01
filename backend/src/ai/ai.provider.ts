/**
 * ai.provider.ts — Abstract AI Provider interface
 *
 * Every AI provider (Groq, OpenAI, Claude) must implement this interface.
 * This enables the router to swap providers transparently and
 * provides a standard fallback chain.
 */

import type { AIResult, GenerateEmailParams, HumanizeEmailParams, GenerateSubjectsParams, SegmentContactsParams } from "../shared/types.js";

// ── Abstract Provider Interface ───────────────────────────────────────────────

export interface AIProvider {
  /** Unique provider identifier */
  readonly name: string;

  /** Check if this provider is currently configured and available */
  isAvailable(): boolean;

  /**
   * Generate a personalized cold email body.
   * Returns a string content in AIResult.
   */
  generateEmail(params: GenerateEmailParams): Promise<AIResult>;

  /**
   * Humanize an existing email draft — remove AI footprints.
   * Returns a string content in AIResult.
   */
  humanizeEmail(params: HumanizeEmailParams): Promise<AIResult>;

  /**
   * Generate subject line suggestions for an email body.
   * Returns string[] content in AIResult.
   */
  generateSubjects(params: GenerateSubjectsParams): Promise<AIResult>;

  /**
   * Segment a list of contacts into target audience groups.
   * Returns structured segment definitions in AIResult.
   */
  segmentContacts(params: SegmentContactsParams): Promise<AIResult>;
}

// ── Base Provider Class ───────────────────────────────────────────────────────

/**
 * Abstract base class with shared utilities.
 * Concrete providers extend this class.
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract isAvailable(): boolean;
  abstract generateEmail(params: GenerateEmailParams): Promise<AIResult>;
  abstract humanizeEmail(params: HumanizeEmailParams): Promise<AIResult>;
  abstract generateSubjects(params: GenerateSubjectsParams): Promise<AIResult>;
  abstract segmentContacts(params: SegmentContactsParams): Promise<AIResult>;

  /** Calculate approximate cost based on token usage */
  protected calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): number {
    // TODO: Import AI_TOKEN_COSTS from constants and compute properly
    // For now, a safe conservative estimate
    const costPer1kInput = 0.001;
    const costPer1kOutput = 0.002;
    return (
      (promptTokens / 1_000) * costPer1kInput +
      (completionTokens / 1_000) * costPer1kOutput
    );
  }

  /** Build a standard AIResult with fallback flag */
  protected buildResult(
    content: string | string[],
    model: string,
    promptTokens: number,
    completionTokens: number,
    fallbackUsed: boolean = false
  ): AIResult {
    const totalTokens = promptTokens + completionTokens;
    return {
      content,
      promptTokens,
      completionTokens,
      totalTokens,
      provider: this.name as any,
      model,
      fallbackUsed,
      costUsd: this.calculateCost(model, promptTokens, completionTokens),
    };
  }
}
