import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

/**
 * Chat API (Pages Router): POST /api/chat
 *
 * Uses OpenAI Responses API + Structured Outputs via `text.format` (json_schema).
 * See: https://platform.openai.com/docs/guides/structured-outputs
 *
 * Expected request body:
 * {
 *   conversationId?: string,
 *   messages: Array<{ role: "user" | "assistant"; content: string }>,
 *   lead?: { name?: string|null; email?: string|null; phone?: string|null; company?: string|null; website?: string|null; },
 * }
 *
 * Response:
 * { ok: true, reply: string, lead: {...}, returnId?: string, emailed: boolean }
 */

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

type Lead = {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
};

type ChatOutput = {
  reply: string;
  // Always include all keys (Structured Outputs requires required[] include every key in properties)
  lead: Lead;
  // Ask only ONE question at a time when more info is needed
  next_question: string | null;
  // Only request email when user explicitly wants follow-up
  wants_follow_up: boolean;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeLead(input?: Partial<Lead> | null): Lead {
  return {
    name: input?.name ?? null,
    email: input?.email ?? null,
    phone: input?.phone ?? null,
    company: input?.company ?? null,
    website: input?.website ?? null,
  };
}

function looksLikeFollowUpIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /(contact me|call me|email me|reach out|book|schedule|consultation|talk to|get started|quote|proposal|follow up)/.test(
    t
  );
}

async function maybeEmailLeadSummary(args: {
  lead: Lead;
  conversationId?: string;
  lastUserMessage: string;
  reply: string;
  returnId?: string;
}): Promise<boolean> {
  // This function is intentionally optional: if Resend isn't configured, it simply won't email.
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_TO_EMAIL = process.env.RESEND_TO_EMAIL || "hello@xdragon.tech";
  const RESEND_FROM = process.env.RESEND_FROM_EMAIL; // must be a verified sender in Resend, e.g. "X Dragon <noreply@xdragon.tech>"

  if (!RESEND_API_KEY || !RESEND_FROM) return false;
  if (!args.lead.email) return false;

  // Lazy import to keep dependency optional if you ever swap providers
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resend } = require("resend") as typeof import("resend");
  const resend = new Resend(RESEND_API_KEY);

  const subject = `New chat lead: ${args.lead.name || "Unknown"} (${args.lead.email})`;

  const lines = [
    `Conversation: ${args.conversationId || "n/a"}`,
    `ReturnId: ${args.returnId || "n/a"}`,
    "",
    "Lead",
    `- Name: ${args.lead.name || "n/a"}`,
    `- Email: ${args.lead.email || "n/a"}`,
    `- Phone: ${args.lead.phone || "n/a"}`,
    `- Company: ${args.lead.company || "n/a"}`,
    `- Website: ${args.lead.website || "n/a"}`,
    "",
    "Last user message",
    args.lastUserMessage,
    "",
    "Assistant reply",
    args.reply,
  ];

  await resend.emails.send({
    from: RESEND_FROM,
    to: RESEND_TO_EMAIL,
    replyTo: args.lead.email,
    subject,
    text: lines.join("\n"),
  });

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { conversationId, messages, lead } = (req.body || {}) as {
      conversationId?: string;
      messages?: ChatMessage[];
      lead?: Partial<Lead> | null;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "Missing messages[]" });
    }

    // Ensure roles are constrained to "user" | "assistant"
    const msgs: ChatMessage[] = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }));

    if (msgs.length === 0) {
      return res.status(400).json({ ok: false, error: "No valid messages" });
    }

    const leadIn = normalizeLead(lead || null);

    // One-question-at-a-time behavior: we bias the model to ask at most one question.
    // Also: only ask for email after user expresses follow-up intent.
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content || "";
    const userWantsFollowUp = looksLikeFollowUpIntent(lastUser);

    const instructions = [
      "You are X Dragon Technologies' website chat assistant.",
      "Audience: startups to medium-sized businesses.",
      "Tone: professional, confident, solution-oriented, ROI-focused.",
      "",
      "Goals:",
      "1) Answer FAQs about X Dragon (AI consulting, infrastructure management, automation & data pipelines).",
      "2) Qualify leads by asking ONE question at a time.",
      "3) Only request email if the user explicitly wants follow-up (e.g., booking, contact, proposal).",
      "",
      `Known lead details so far (may be empty): ${JSON.stringify(leadIn)}`,
      `User follow-up intent detected: ${userWantsFollowUp ? "true" : "false"}`,
      "",
      "Output rules:",
      "- Return JSON matching the provided schema (no extra keys).",
      "- If more info is needed, put the single best next question in next_question.",
      "- reply should be user-facing prose, and may include the question from next_question at the end.",
      "- If user wants follow-up AND email is missing, ask ONLY for email (one question). Set wants_follow_up true.",
      "- If user wants follow-up AND email is present, confirm you will reach out and DO NOT ask any questions. Set next_question to null.",
    ].join("\n");

    const input = msgs.map((m) => ({ role: m.role, content: m.content }));

    // Structured Outputs via Responses API uses `text.format`, not `response_format`.
    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "xdragon_chat",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply: { type: "string" },
              lead: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { anyOf: [{ type: "string" }, { type: "null" }] },
                  email: { anyOf: [{ type: "string" }, { type: "null" }] },
                  phone: { anyOf: [{ type: "string" }, { type: "null" }] },
                  company: { anyOf: [{ type: "string" }, { type: "null" }] },
                  website: { anyOf: [{ type: "string" }, { type: "null" }] },
                },
                required: ["name", "email", "phone", "company", "website"],
              },
              next_question: { anyOf: [{ type: "string" }, { type: "null" }] },
              wants_follow_up: { type: "boolean" },
            },
            required: ["reply", "lead", "next_question", "wants_follow_up"],
          },
        },
      },
    } as any);

    const rawText =
      (response as any).output_text ??
      (() => {
        const msg = (response as any).output?.find((o: any) => o.type === "message");
        const t = msg?.content?.find((c: any) => c.type === "output_text")?.text;
        return typeof t === "string" ? t : "";
      })();

    const fallback: ChatOutput = {
      reply: rawText || "Thanks — how can we help?",
      lead: leadIn,
      next_question: null,
      wants_follow_up: false,
    };

    let out: ChatOutput = fallback;

    // Prefer parsed output if present (some SDK helpers populate output_parsed)
    const parsed = (response as any).output_parsed as ChatOutput | undefined;
    if (parsed && typeof parsed.reply === "string" && parsed.lead) {
      out = parsed;
    } else {
      try {
        const maybe = JSON.parse(rawText) as ChatOutput;
        if (maybe && typeof maybe.reply === "string" && maybe.lead) out = maybe;
      } catch {
        // keep fallback
      }
    }
    // Merge lead (model may fill some fields; preserve existing if model returns null)
    const mergedLead: Lead = {
      name: out.lead.name ?? leadIn.name,
      email: out.lead.email ?? leadIn.email,
      phone: out.lead.phone ?? leadIn.phone,
      company: out.lead.company ?? leadIn.company,
      website: out.lead.website ?? leadIn.website,
    };

    // Ensure one-question behavior: if email missing but wants follow-up, force only the email question
    let reply = out.reply?.trim() || "";
    let wants_follow_up = out.wants_follow_up || userWantsFollowUp;

    // If follow-up is requested and we already have an email, do NOT ask more questions.
    if (wants_follow_up && mergedLead.email) {
      const nm = (mergedLead.name && mergedLead.name.trim()) ? mergedLead.name.trim() : "there";
      reply = `Thank you, ${nm}. We\'ll reach out to you soon at ${mergedLead.email}.`;
      out.next_question = null;
    }

    if (wants_follow_up && !mergedLead.email) {
      const emailQ = "What’s the best email to reach you at?";
      // If the model asked something else, override to email-only.
      reply = reply ? `${reply}\n\n${emailQ}` : emailQ;
      out.next_question = emailQ;
    } else if (out.next_question) {
      // Encourage only one question by ensuring it's included at end (but don't duplicate)
      const q = out.next_question.trim();
      if (q && !reply.includes(q)) reply = reply ? `${reply}\n\n${q}` : q;
    }

    const returnId = (response as any).id as string | undefined;

    // If follow-up wanted and we have an email, send a lead summary email to the business
    let emailed = false;
    if (wants_follow_up && mergedLead.email) {
      emailed = await maybeEmailLeadSummary({
        lead: mergedLead,
        conversationId,
        lastUserMessage: lastUser,
        reply,
        returnId,
      });
    }

    return res.status(200).json({
      ok: true,
      reply,
      lead: mergedLead,
      returnId,
      emailed,
    });
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    const status = err?.status || 500;
    return res.status(status).json({ ok: false, error: message });
  }
}
