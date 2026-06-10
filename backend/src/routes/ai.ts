import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const router = Router();
router.use(requireAuth); // Requires authentication for any AI requests

const groqKey = process.env.GROQ_API_KEY;
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null;

// Helper fallback generators in case Groq is unavailable
function fallbackGenerate(brief: string, recipient: any): string {
  const name = recipient.name || recipient.Name || recipient.FirstName || "there";
  const company = recipient.company || recipient.Company || "your company";
  return `Hi ${name},\n\nI noticed you are doing some amazing work at ${company}. \n\n${brief}\n\nI'd love to connect sometime this week to discuss how we can help. Does Thursday at 2:00 PM work for a brief 10-minute chat?\n\nBest,\nCampaign Team`;
}

function fallbackHumanize(body: string): string {
  return body.replace(/\b(utilize|leverage|synergy|optimize|disrupt|paradigm shift)\b/gi, (m) => {
    switch (m.toLowerCase()) {
      case "utilize":
        return "use";
      case "leverage":
        return "use";
      case "synergy":
        return "teamwork";
      case "optimize":
        return "improve";
      default:
        return "help";
    }
  });
}

function fallbackSubjects(body: string): string[] {
  const snippet = body.split(/\s+/).slice(0, 4).join(" ");
  return [
    `Quick idea on ${snippet}`,
    `Question about your team`,
    `Following up regarding ${snippet}`,
    `Simple thought for you`,
    `Worth 5 minutes?`,
  ];
}

// 1. POST /ai/generate
router.post("/generate", async (req: AuthenticatedRequest, res: Response) => {
  const { brief, recipient } = req.body;

  if (!brief || !recipient) {
    return res.status(400).json({ error: "Missing required parameters: brief, recipient." });
  }

  if (!groq) {
    console.warn("Groq Client not configured, utilizing fallback generator.");
    return res.json(fallbackGenerate(brief, recipient));
  }

  try {
    const name = recipient.name || recipient.Name || recipient.FirstName || "there";
    const company = recipient.company || recipient.Company || "their company";
    const title = recipient.title || recipient.Title || recipient.Role || "executive";

    const prompt = `You are a professional, premium copywriter specializing in highly personalized B2B cold email marketing campaigns.

Task: Write a concise, compelling cold outreach email to a potential lead based on the following:
- Outreach Brief/Goal: "${brief}"
- Lead Name: "${name}"
- Lead Company: "${company}"
- Lead Job Title: "${title}"

Rules:
1. Keep the email short (under 120 words).
2. Avoid generic corporate jargon, fake warmth, and cheesy subject lines. 
3. Write ONLY the email body itself. Do not write a Subject line, and do not include placeholder brackets or introductory conversation. Make the email feel completely hand-written.
4. Structure it with natural spacing, a simple conversational tone, and a light call-to-action (e.g. asking for 5 minutes).`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 250,
    });

    const emailBody = chatCompletion.choices[0]?.message?.content?.trim() || "";
    return res.json(emailBody || fallbackGenerate(brief, recipient));
  } catch (err: any) {
    console.error("Groq email generate failed:", err);
    return res.json(fallbackGenerate(brief, recipient));
  }
});

// 2. POST /ai/humanize
router.post("/humanize", async (req: AuthenticatedRequest, res: Response) => {
  const { body } = req.body;

  if (!body) {
    return res.status(400).json({ error: "Missing required parameter: body." });
  }

  if (!groq) {
    console.warn("Groq Client not configured, utilizing fallback humanizer.");
    return res.json(fallbackHumanize(body));
  }

  try {
    const prompt = `You are an expert editor who makes business emails sound completely natural, human, and authentic.

Task: Rewrite the following email draft to remove standard AI writing footprints, corporate buzzwords, and dry jargon (such as "leverage", "utilize", "synergize", "hope this email finds you well", "uniquely positioned", etc.).

Rules:
1. Make it sound like a friendly, thoughtful person wrote it in one take.
2. Keep the core pitch, structure, and spacing the same.
3. Write ONLY the rewritten email body itself. Do not include chat intro or explanation.

Original Email Draft:
---
${body}
---`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 300,
    });

    const humanizedBody = chatCompletion.choices[0]?.message?.content?.trim() || "";
    return res.json(humanizedBody || fallbackHumanize(body));
  } catch (err) {
    console.error("Groq email humanize failed:", err);
    return res.json(fallbackHumanize(body));
  }
});

// 3. POST /ai/subjects
router.post("/subjects", async (req: AuthenticatedRequest, res: Response) => {
  const { body } = req.body;

  if (!body) {
    return res.status(400).json({ error: "Missing required parameter: body." });
  }

  if (!groq) {
    console.warn("Groq Client not configured, utilizing fallback subjects.");
    return res.json(fallbackSubjects(body));
  }

  try {
    const prompt = `Analyze the following B2B sales email body and brainstorm exactly 5 high-converting, casual cold email subject lines.

Rules:
1. Keep them extremely short (2 to 5 words).
2. Avoid clickbait, capital letter spam, and standard sales hype. Use natural, lower-case styled headers (e.g. "quick question" or "help with [topic]").
3. Output ONLY a valid JSON array of strings. Do not include chat intro, numbers, or explanation.

Email Body:
---
${body}
---`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    const subjects = parsed.subjects || parsed.suggestions || parsed;

    if (Array.isArray(subjects) && subjects.length > 0) {
      return res.json(subjects);
    }

    return res.json(fallbackSubjects(body));
  } catch (err) {
    console.error("Groq email subjects failed:", err);
    return res.json(fallbackSubjects(body));
  }
});

export default router;
