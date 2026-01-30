import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

/**
 * Chat API (Pages Router): POST /api/chat
 *
 * Required env:
 *   OPENAI_API_KEY
 *
 * Optional env (lead summaries emailed via Resend):
 *   RESEND_API_KEY
 *   RESEND_FROM   e.g. "X Dragon <hello@xdragon.tech>" (must be verified in Resend)
 *   CONTACT_TO    e.g. "hello@xdragon.tech"
 */

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type Lead = {
  name?: string;
  email?: string;
  company?: string;
  website?: string;
  monthlyRevenueRange?: string;
  timeline?: string;
  problem?: string;
  bestContactMethod?: string;
};

type ChatRequestBody = {
  conversationId?: string;
  messages: ChatMessage[];
  lead?: Lead;
  url?: string;
};

type ChatResponse = {
  ok: boolean;
  reply?: string;
  lead?: Lead;
  returnId?: string;
  emailed?: boolean;
  error?: string;
};

// OpenAI input messages can include a system role, but our UI only uses user/assistant.
type OpenAIInputRole = "system" | "user" | "assistant";
type OpenAIInputMessage = { role: OpenAIInputRole; content: string };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clampMessages(msgs: ChatMessage[], max: number): ChatMessage[] {
  if (msgs.length <= max) return msgs;
  const head = msgs[0]?.role === "assistant" ? [msgs[0]] : [];
  const tail = msgs.slice(-Math.max(0, max - head.length));
  return [...head, ...tail];
}

/**
 * NOTE on strict JSON Schema:
 * With `strict: true`, OpenAI requires every object with `properties` to also provide a `required`
 * array that includes *every* key in `properties`.
 *
 * To still represent "optional" fields, we mark them as nullable (string | null) and require them,
 * then we sanitize nulls back out in our API response before returning to the client.
 */
const LEAD_KEYS = [
  "name",
  "email",
  "company",
  "website",
  "monthlyRevenueRange",
  "timeline",
  "problem",
  "bestContactMethod",
] as const;

const CHAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "lead", "should_email_lead"],
  properties: {
    reply: { type: "string" },
    lead: {
      type: "object",
      additionalProperties: false,
      required: [...LEAD_KEYS],
      properties: {
        name: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        company: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
        monthlyRevenueRange: { type: ["string", "null"] },
        timeline: { type: ["string", "null"] },
        problem: { type: ["string", "null"] },
        bestContactMethod: { type: ["string", "null"] },
      },
    },
    should_email_lead: { type: "boolean" },
  },
} as const;

function stripNullLeadFields(input: any): Lead {
  const out: Lead = {};
  for (const k of LEAD_KEYS) {
    const v = input?.[k];
    if (typeof v === "string" && v.trim()) (out as any)[k] = v.trim();
  }
  return out;
}

async function maybeSendLeadEmail(params: {
  lead: Lead;
  conversationId: string;
  url?: string;
  transcript: ChatMessage[];
}): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM = process.env.RESEND_FROM;
  const CONTACT_TO = process.env.CONTACT_TO;

  if (!RESEND_API_KEY || !RESEND_FROM || !CONTACT_TO) return false;

  const { lead, conversationId, url, transcript } = params;
  const safe = (s?: string) => (s || "").toString().trim();

  const subject = `New lead (chat) — ${safe(lead.name) || "Visitor"}${
    safe(lead.company) ? " @ " + safe(lead.company) : ""
  }`;

  const text = [
    "New website chat lead:",
    "",
    `Name: ${safe(lead.name) || "-"}`,
    `Email: ${safe(lead.email) || "-"}`,
    `Company: ${safe(lead.company) || "-"}`,
    `Website: ${safe(lead.website) || "-"}`,
    `Monthly revenue range: ${safe(lead.monthlyRevenueRange) || "-"}`,
    `Timeline: ${safe(lead.timeline) || "-"}`,
    `Best contact method: ${safe(lead.bestContactMethod) || "-"}`,
    `Problem: ${safe(lead.problem) || "-"}`,
    "",
    url ? `Page: ${url}` : null,
    `Conversation ID: ${conversationId}`,
    "",
    "Transcript (most recent):",
    ...transcript.slice(-12).map((m) => `${m.role.toUpperCase()}: ${m.content}`),
  ]
    .filter(Boolean)
    .join("\n");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [CONTACT_TO], subject, text }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    console.error("Resend email failed:", resp.status, errText);
    return false;
  }

  return true;
}

/**
 * Stronger trigger:
 * - If the model says should_email_lead = true, we email.
 * - ALSO email if we have a visitor email AND their most recent message implies they want follow-up.
 *
 * This prevents "no email sent" when the model forgets to flip should_email_lead.
 */
function userWantsFollowUp(lastUserMessage: string): boolean {
  const s = (lastUserMessage || "").toLowerCase();
  return (
    s.includes("contact") ||
    s.includes("reach me") ||
    s.includes("email me") ||
    s.includes("call me") ||
    s.includes("book") ||
    s.includes("consult") ||
    s.includes("talk to") ||
    s.includes("get started") ||
    s.includes("next steps") ||
    s.includes("follow up")
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ChatResponse>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ ok: false, error: "Server is missing OPENAI_API_KEY" });
  }

  try {
    const body = req.body as ChatRequestBody;
    const conversationId = body.conversationId || `c_${Date.now()}`;
    const msgs = clampMessages(body.messages || [], 14);
    const leadIn: Lead = body.lead || {};

    const instructions = [
      "You are the website chat assistant for X Dragon Technologies.",
      "",
      "Business positioning:",
      "- We provide AI consulting (strategy, roadmap, quick wins, implementation) and Infrastructure Management (reliability, scaling, monitoring) plus Automation & Data Pipelines.",
      "- Primary audience: startups through medium-sized businesses.",
      "- Style: professional, confident, solution-oriented, ROI-focused, and problem-solving.",
      "",
      "Goals:",
      "1) Answer questions about X Dragon's services and how we help.",
      "2) Qualify leads when appropriate (project type, timeline, constraints, desired outcome).",
      "3) Encourage a consultation when there's fit. If user asks to be contacted, gather name + email at minimum.",
      "",
      "Rules:",
      "- Keep replies concise (2–6 sentences) unless the user asks for detail.",
      "- Don't mention competitors or benchmark against specific competitors.",
      "- If asked about pricing: explain that we scope first, then propose a plan; offer a consultation.",
      "- Only request contact details if the user wants follow-up or is clearly a strong lead.",
      "- If the user provides an email or asks to be contacted, set should_email_lead=true and include lead fields you have.",
      "",
      "Return JSON that matches the provided schema. For lead fields you don't know, use null.",
    ].join("\n");

    const input: OpenAIInputMessage[] = msgs.map((m) => ({ role: m.role, content: m.content }));
    input.unshift({
      role: "system",
      content: `Known lead details so far (may be empty): ${JSON.stringify(leadIn || {})}`,
    });

    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "xdragon_chat",
          strict: true,
          schema: CHAT_SCHEMA,
        },
      },
      temperature: 0.6,
    });

    const raw = (response as any).output_text as string | undefined;
    if (!raw) return res.status(500).json({ ok: false, error: "No model output text returned" });

    const parsed = JSON.parse(raw) as { reply: string; lead: any; should_email_lead: boolean };

    const leadFromModel = stripNullLeadFields(parsed.lead);
    const mergedLead: Lead = { ...(leadIn || {}), ...(leadFromModel || {}) };

    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content || "";
    const wantsFollowUp = parsed.should_email_lead || (Boolean(mergedLead.email) && userWantsFollowUp(lastUser));

    let emailed = false;
    if (wantsFollowUp && mergedLead.email) {
      emailed = await maybeSendLeadEmail({ lead: mergedLead, conversationId, url: body.url, transcript: msgs });
    }

    return res.status(200).json({
      ok: true,
      reply: parsed.reply,
      lead: mergedLead,
      returnId: (response as any).id,
      emailed,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}
