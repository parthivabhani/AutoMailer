/**
 * ai.router.ts — AI provider selection and fallback orchestration
 *
 * Implements the provider cascade:
 *   1. Configured primary provider (GROQ / OPENAI / CLAUDE)
 *   2. Next available provider
 *   3. Local fallback (hardcoded heuristics — always available)
 *
 * Also handles:
 * - AI usage tracking (writes to ai_usage table)
 * - Error handling and retry logic
 */

import type { AIProvider } from "./ai.provider.js";
import type {
  AIResult,
  GenerateEmailParams,
  HumanizeEmailParams,
  GenerateSubjectsParams,
  SegmentContactsParams,
  AIOperation,
} from "../shared/types.js";
import { groqProvider } from "./providers/groq.provider.js";
import { openaiProvider } from "./providers/openai.provider.js";
import { claudeProvider } from "./providers/claude.provider.js";
import { getEnv } from "../config/env.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import { logger } from "../shared/logger.js";
import { aiService } from "./ai.service.js";

// ── Local Fallback Generators (always available) ──────────────────────────────

function localGenerateEmail(params: GenerateEmailParams): AIResult {
  const name = params.recipient.name || params.recipient.Name || "there";
  const company = params.recipient.company || params.recipient.Company || "your company";
  const content = `Hi ${name},\n\nI noticed you are doing some amazing work at ${company}.\n\n${params.brief}\n\nI'd love to connect sometime this week to discuss how we can help. Does Thursday at 2:00 PM work for a brief 10-minute chat?\n\nBest,\nTeam`;
  return {
    content,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    provider: "groq",
    model: "local-fallback",
    fallbackUsed: true,
    costUsd: 0,
  };
}

function localHumanizeEmail(params: HumanizeEmailParams): AIResult {
  const content = params.body.replace(
    /\b(utilize|leverage|synergy|optimize|disrupt|paradigm shift)\b/gi,
    (m) =>
      ({ utilize: "use", leverage: "use", synergy: "teamwork", optimize: "improve" })[
        m.toLowerCase()
      ] || "help",
  );
  return {
    content,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    provider: "groq",
    model: "local-fallback",
    fallbackUsed: true,
    costUsd: 0,
  };
}

function localGenerateSubjects(params: GenerateSubjectsParams): AIResult {
  const snippet = params.body.split(/\s+/).slice(0, 4).join(" ");
  const subjects = [
    `Quick idea on ${snippet}`,
    `Question about your team`,
    `Following up regarding ${snippet}`,
    `Simple thought for you`,
    `Worth 5 minutes?`,
  ];
  return {
    content: subjects,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    provider: "groq",
    model: "local-fallback",
    fallbackUsed: true,
    costUsd: 0,
  };
}

// ── Provider Priority Order ───────────────────────────────────────────────────

function getProviderPriorityList(): AIProvider[] {
  const env = getEnv();
  const primary = env.AI_DEFAULT_PROVIDER;

  const all: Record<string, AIProvider> = {
    groq: groqProvider,
    openai: openaiProvider,
    claude: claudeProvider,
  };

  // Put the configured primary provider first
  const ordered: AIProvider[] = [];
  if (all[primary]) ordered.push(all[primary]);
  for (const [key, provider] of Object.entries(all)) {
    if (key !== primary) ordered.push(provider);
  }

  return ordered.filter((p) => p.isAvailable());
}

// ── Usage Tracking ────────────────────────────────────────────────────────────

async function trackAIUsage(
  businessId: string,
  userId: string,
  operation: AIOperation,
  result: AIResult,
): Promise<void> {
  try {
    await getSupabaseAdmin().from("ai_usage").insert({
      business_id: businessId,
      user_id: userId,
      provider: result.provider,
      model: result.model,
      operation,
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
      total_tokens: result.totalTokens,
      cost_usd: result.costUsd,
    });
  } catch (err) {
    // Non-critical — don't throw
    logger.warn({ err, operation }, "Failed to track AI usage");
  }
}

// ── AI Router ─────────────────────────────────────────────────────────────────

export class AIRouter {
  /**
   * Runs an AI operation with provider cascade.
   * Tries each available provider in order, falling back to local fallback.
   */
  private async runWithFallback(
    operation: string,
    providers: AIProvider[],
    fn: (provider: AIProvider) => Promise<AIResult>,
    localFallback: () => AIResult,
  ): Promise<AIResult> {
    for (const provider of providers) {
      try {
        const result = await fn(provider);
        logger.debug({ provider: provider.name, operation }, "AI operation succeeded");
        return result;
      } catch (err) {
        logger.warn(
          { provider: provider.name, operation, err },
          `AI provider failed, trying next...`,
        );
      }
    }

    // All providers failed — use local fallback
    logger.warn({ operation }, "All AI providers failed, using local fallback");
    return localFallback();
  }

  /**
   * Helper that checks capacity, handles caching, runs the cascade, and records usage.
   */
  private async executeWithGuards(
    operation: AIOperation,
    businessId: string,
    userId: string,
    cacheKeyParams: Record<string, any>,
    runCascade: () => Promise<AIResult>,
  ): Promise<AIResult> {
    // 1. Capacity check
    const hasCapacity = await aiService.checkAICapacity(businessId);
    if (!hasCapacity) {
      throw new Error(
        "AI token limit exceeded. Please upgrade your plan to generate more content.",
      );
    }

    // 2. Cache check
    const cacheKey = aiService.getCacheKey(operation, cacheKeyParams);
    try {
      const cached = await aiService.getCachedResult(cacheKey);
      if (cached) {
        logger.info({ operation, businessId }, "Serving AI operation from cache");
        return JSON.parse(cached) as AIResult;
      }
    } catch (cacheErr) {
      logger.warn({ cacheErr }, "Failed to read from cache");
    }

    // 3. Execute cascade
    const result = await runCascade();

    // 4. Track tokens used in subscription
    if (result.totalTokens > 0) {
      await aiService.trackTokensUsed(businessId, result.totalTokens);
    }

    // 5. Log details in usage history
    await trackAIUsage(businessId, userId, operation, result);

    // 6. Write back to cache
    try {
      await aiService.setCachedResult(cacheKey, JSON.stringify(result));
    } catch (cacheErr) {
      logger.warn({ cacheErr }, "Failed to write to cache");
    }

    return result;
  }

  async generateEmail(params: GenerateEmailParams): Promise<AIResult> {
    const providers = getProviderPriorityList();
    return this.executeWithGuards(
      "generate",
      params.businessId,
      params.userId,
      { brief: params.brief, recipient: params.recipient },
      () =>
        this.runWithFallback(
          "generateEmail",
          providers,
          (p) => p.generateEmail(params),
          () => localGenerateEmail(params),
        ),
    );
  }

  async humanizeEmail(params: HumanizeEmailParams): Promise<AIResult> {
    const providers = getProviderPriorityList();
    return this.executeWithGuards(
      "humanize",
      params.businessId,
      params.userId,
      { body: params.body },
      () =>
        this.runWithFallback(
          "humanizeEmail",
          providers,
          (p) => p.humanizeEmail(params),
          () => localHumanizeEmail(params),
        ),
    );
  }

  async generateSubjects(params: GenerateSubjectsParams): Promise<AIResult> {
    const providers = getProviderPriorityList();
    return this.executeWithGuards(
      "subject",
      params.businessId,
      params.userId,
      { body: params.body, count: params.count },
      () =>
        this.runWithFallback(
          "generateSubjects",
          providers,
          (p) => p.generateSubjects(params),
          () => localGenerateSubjects(params),
        ),
    );
  }

  async segmentContacts(params: SegmentContactsParams): Promise<AIResult> {
    const providers = getProviderPriorityList();
    return this.executeWithGuards(
      "segment",
      params.businessId,
      params.userId,
      { rowsCount: params.rows.length, columns: params.columns },
      () =>
        this.runWithFallback(
          "segmentContacts",
          providers,
          (p) => p.segmentContacts(params),
          () => ({
            content: "[]",
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            provider: "groq",
            model: "local-fallback",
            fallbackUsed: true,
            costUsd: 0,
          }),
        ),
    );
  }
}

// Export singleton
export const aiRouter = new AIRouter();
