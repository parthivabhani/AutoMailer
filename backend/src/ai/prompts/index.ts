/**
 * prompts/index.ts — Prompt template exports
 * Centralized prompt factory functions for all AI operations.
 */

// ── Email Generation ──────────────────────────────────────────────────────────

export function EMAIL_GENERATE_PROMPT(params: {
  brief: string;
  name: string;
  company: string;
  title: string;
}): string {
  return `You are a professional, premium copywriter specializing in highly personalized B2B cold email marketing campaigns.

Task: Write a concise, compelling cold outreach email to a potential lead based on the following:
- Outreach Brief/Goal: "${params.brief}"
- Lead Name: "${params.name}"
- Lead Company: "${params.company}"
- Lead Job Title: "${params.title}"

Rules:
1. Keep the email short (under 120 words).
2. Avoid generic corporate jargon, fake warmth, and cheesy subject lines.
3. Write ONLY the email body itself. Do not write a Subject line, and do not include placeholder brackets or introductory conversation. Make the email feel completely hand-written.
4. Structure it with natural spacing, a simple conversational tone, and a light call-to-action (e.g. asking for 5 minutes).`;
}

// ── Email Humanization ────────────────────────────────────────────────────────

export function EMAIL_HUMANIZE_PROMPT(params: { body: string }): string {
  return `You are an expert editor who makes business emails sound completely natural, human, and authentic.

Task: Rewrite the following email draft to remove standard AI writing footprints, corporate buzzwords, and dry jargon (such as "leverage", "utilize", "synergize", "hope this email finds you well", "uniquely positioned", etc.).

Rules:
1. Make it sound like a friendly, thoughtful person wrote it in one take.
2. Keep the core pitch, structure, and spacing the same.
3. Write ONLY the rewritten email body itself. Do not include chat intro or explanation.

Original Email Draft:
---
${params.body}
---`;
}

// ── Subject Line Generation ───────────────────────────────────────────────────

export function SUBJECT_GENERATE_PROMPT(params: { body: string; count: number }): string {
  return `Analyze the following B2B sales email body and brainstorm exactly ${params.count} high-converting, casual cold email subject lines.

Rules:
1. Keep them extremely short (2 to 5 words).
2. Avoid clickbait, capital letter spam, and standard sales hype. Use natural, lower-case styled headers (e.g. "quick question" or "help with [topic]").
3. Output ONLY a valid JSON object with key "subjects" containing an array of strings. Do not include chat intro, numbers, or explanation.

Email Body:
---
${params.body}
---`;
}

// ── Contact Segmentation ──────────────────────────────────────────────────────

export function SEGMENTATION_PROMPT(params: { sampleRows: Record<string, any>[] }): string {
  return `You are a data intelligence engine. I have a list of sales/marketing lead contacts. Here is a sample of the data (each row has an '_id' field):
${JSON.stringify(params.sampleRows, null, 2)}

Your task is to analyze these leads and create exactly 3 distinct, high-converting target segments/clusters (e.g. "Tech Startups", "Healthcare Enterprises", "Marketing Agencies", or based on business titles like "Software Executives", "Marketing Directors") depending on the data provided.

Output your response as a valid JSON object with key "segments" containing an array of objects, where each object has:
1. "label": string (the name of the target segment)
2. "criteria": string (1-sentence describing the criteria for this segment)

Respond ONLY with the raw JSON object. Do not include markdown blocks, notes, or chat. Make it a strict JSON format.`;
}

// ── Lead Scoring ──────────────────────────────────────────────────────────────

export function LEAD_SCORE_PROMPT(params: {
  contact: Record<string, any>;
  context: string;
}): string {
  return `You are a B2B sales intelligence engine. Score the following contact for sales potential.

Context: ${params.context}
Contact Data: ${JSON.stringify(params.contact)}

Return a JSON object with:
- "score": integer 0-100 (higher = higher priority lead)
- "tier": "hot" | "warm" | "cold"
- "reasoning": string (1-2 sentences explaining the score)

Respond ONLY with valid JSON.`;
}
