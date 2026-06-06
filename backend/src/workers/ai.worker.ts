/**
 * ai.worker.ts — AI background job worker
 *
 * Processes enqueued AI tasks such as batch email generation,
 * lead scoring, and automated segmentation. Updates the database
 * or invokes callbacks upon completion.
 */

import { Worker, type Job } from "bullmq";
import { createBullMQConnection } from "../config/redis.js";
import { QUEUE_NAMES } from "../config/constants.js";
import { aiRouter } from "../ai/ai.router.js";
import { workerLogger } from "../shared/logger.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import type { AIJobData, AIResult } from "../shared/types.js";
import { LEAD_SCORE_PROMPT } from "../ai/prompts/index.js";

async function processAIJob(job: Job<AIJobData>): Promise<AIResult> {
  const { operation, params, businessId, userId, callbackJobId } = job.data;

  workerLogger.info(
    { jobId: job.id, operation, businessId, userId },
    "Processing AI background task"
  );

  let result: AIResult;

  switch (operation) {
    case "generate": {
      result = await aiRouter.generateEmail({
        brief: params.brief,
        recipient: params.recipient,
        businessId,
        userId,
      });
      break;
    }

    case "humanize": {
      result = await aiRouter.humanizeEmail({
        body: params.body,
        businessId,
        userId,
      });
      break;
    }

    case "subject": {
      result = await aiRouter.generateSubjects({
        body: params.body,
        count: params.count,
        businessId,
        userId,
      });
      break;
    }

    case "segment": {
      result = await aiRouter.segmentContacts({
        rows: params.rows,
        columns: params.columns,
        businessId,
        userId,
      });
      break;
    }

    case "score": {
      // Implement lead scoring using LEAD_SCORE_PROMPT
      const prompt = LEAD_SCORE_PROMPT({
        contact: params.contact,
        context: params.context || "B2B sales lead qualification",
      });

      // We cascade through standard prompt call
      const fallbackUsed = false;
      const response = await aiRouter.generateEmail({
        brief: `Qualify this lead. Lead scoring prompt: ${prompt}`,
        recipient: params.contact,
        businessId,
        userId,
      });

      let parsedScore: { score: number; tier: "hot" | "warm" | "cold"; reasoning: string } = {
        score: 50,
        tier: "warm",
        reasoning: "Default qualification",
      };
      try {
        const text = typeof response.content === "string" ? response.content : response.content[0];
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedScore = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        workerLogger.warn({ err, text: response.content }, "Failed to parse lead score JSON from AI output");
      }

      // Update the contact's is_vip status & vip_score in the database
      if (params.contactId) {
        await getSupabaseAdmin()
          .from("contacts")
          .update({
            is_vip: parsedScore.tier === "hot",
            vip_score: parsedScore.score,
            data: {
              ...(params.contact.data || {}),
              ai_qualification: parsedScore,
            },
          })
          .eq("id", params.contactId);
      }

      result = {
        content: JSON.stringify(parsedScore),
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        provider: response.provider,
        model: response.model,
        fallbackUsed: response.fallbackUsed || fallbackUsed,
        costUsd: response.costUsd,
      };
      break;
    }

    default: {
      throw new Error(`Unsupported AI operation: ${operation}`);
    }
  }

  // Handle callback if registered
  if (callbackJobId) {
    workerLogger.debug({ callbackJobId, operation }, "Triggering callback for AI job completion");
    // Depending on usage, we could post to callback endpoint or queue another job
    // e.g. updating campaign_jobs status
    await getSupabaseAdmin()
      .from("campaign_jobs")
      .update({
        status: "pending",
        recipient_data: {
          ...(params.recipient || {}),
          ai_custom_body: result.content,
        },
      })
      .eq("id", callbackJobId);
  }

  return result;
}

let _aiWorker: Worker | null = null;

export function startAIWorker(): Worker {
  if (_aiWorker) return _aiWorker;

  _aiWorker = new Worker<AIJobData>(
    QUEUE_NAMES.AI_GENERATE,
    processAIJob,
    {
      connection: createBullMQConnection(),
      concurrency: 2, // Concurrency limit for concurrent AI requests
    }
  );

  _aiWorker.on("completed", (job) => {
    workerLogger.debug({ jobId: job.id }, "AI worker job completed");
  });

  _aiWorker.on("failed", (job, err) => {
    workerLogger.error({ jobId: job?.id, err: err.message }, "AI worker job failed");
  });

  workerLogger.info("AI worker started");
  return _aiWorker;
}

export async function stopAIWorker(): Promise<void> {
  if (_aiWorker) {
    await _aiWorker.close();
    _aiWorker = null;
    workerLogger.info("AI worker stopped");
  }
}
