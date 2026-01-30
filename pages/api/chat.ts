import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

/**
 * Chat API (Pages Router): POST /api/chat
 *
 * Structured Outputs via Responses API uses `text.format` (json_schema).
 */

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

type PreferredContact = "email" | "phone" | "text";

type Lead = {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  preferred_contact: PreferredContact | null;
};

type ChatOutput = {
  reply: string;
  lead: Lead; // all keys always present
  next_question: string | null;
  wants_follow_up: boolean;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeLead(input?: Partial<Lead> | null): Lead {
  const pc = input?.preferred_contact ?? null;
  const preferred_contact: PreferredContact | null =
    pc === "email" || pc === "phone" || pc === "text" ? pc : null;

  return {
    name: input?.name ?? null,
    email: input?.email ?? null,
    phone: input?.phone ?? null,
    company: input?.company ?? null,
    website: input?.website ?? null,
    preferred_contact,
  };
}

function looksLikeFollowUpIntent(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /(contact me|call me|email me|reach out|book|schedule|consultation|talk to|get started|quote|proposal|follow up)/.test(
    t
  );
}

function methodLabel(m: PreferredContact) {
  if (m === "email") return "email";
  if (m === "phone") return "phone call";
  return "text";
}

/**
 * Sends a lead summary email to the business inbox.
 * If lead.email exists, it will be used as replyTo; otherwise replyTo is omitted.
 */
async function maybeEmailLeadSummary(args: {
  lead: Lead;
  conversationId?: string;
  lastUserMessage: string;
  reply: string;
  returnId?: string;
}): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_TO_EMAIL = process.env.RESEND_TO_EMAIL || "hello@xdragon.tech";
  const RESEND_FROM = process.env.RESEND_FROM_EMAIL; // must be verified sender, e.g. "X Dragon <noreply@xdragon.tech>"

  if (!RESEND_API_KEY || !RESEND_FROM) return false;

  // Only email when we have SOME contact path
  if (!args.lead.email && !args.lead.phone) return false;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resend } = require("resend") as typeof import("resend");
  const resend = new Resend(RESEND_API_KEY);

  const who = args.lead.name || "New lead";
  const where =
    args.lead.preferred_contact
      ? `${methodLabel(args.lead.preferred_contact)}: ${
          args.lead.preferred_contact === "email" ? args.lead.email || "n/a" : args.lead.phone || "n/a"
        }`
      : `email: ${args.lead.email || "n/a"} / phone: ${args.lead.phone || "n/a"}`;

  const subject = `X Dragon chat lead: ${who} (${where})`;

  const lines = [
    `Conversation: ${args.conversationId || "n/a"}`,
    `ReturnId: ${args.returnId || "n/a"}`,
    "",
    "Lead",
    `- Name: ${args.lead.name || "n/a"}`,
    `- Preferred contact: ${args.lead.preferred_contact || "n/a"}`,
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

  const payload: any = {
    from: RESEND_FROM,
    to: RESEND_TO_EMAIL,
    subject,
    text: lines.join("\n"),
  };
  if (args.lead.email) payload.replyTo = args.lead.email;

  await resend.emails.send(payload);

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { conversationId, messages, lead, emailed: emailedIn } = (req.body || {}) as {
      conversationId?: string;
      messages?: ChatMessage[];
      lead?: Partial<Lead> | null;
      emailed?: boolean;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "Missing messages[]" });
    }

    const msgs: ChatMessage[] = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }));

    if (msgs.length === 0) {
      return res.status(400).json({ ok: false, error: "No valid messages" });
    }

    const leadIn = normalizeLead(lead || null);
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content || "";
    const followUpDetected = looksLikeFollowUpIntent(lastUser);

    const instructions = [
      "You are X Dragon Technologies' website chat assistant.",
      "Audience: startups to medium-sized businesses.",
      "Tone: professional, confident, solution-oriented, ROI-focused.",
      "",
      "Goals:",
      "1) Answer FAQs about X Dragon (AI consulting, infrastructure management, automation & data pipelines).",
      "2) Qualify leads by asking ONE question at a time.",
      "",
      "Follow-up flow (critical):",
      "- If the user wants to be contacted, collect these in order, ONE question at a time:",
      "  (a) name, (b) preferred contact method (email/phone/text), then (c) the needed detail (email or phone).",
      "- Do NOT ask additional qualification questions once follow-up is confirmed.",
      "",
      `Known lead details so far (may be empty): ${JSON.stringify(leadIn)}`,
      `User follow-up intent detected: ${followUpDetected ? "true" : "false"}`,
      "",
      "Output rules:",
      "- Return JSON matching the provided schema (no extra keys).",
      "- If more info is needed, put the single best next question in next_question.",
      "- reply should be user-facing prose and may include next_question at the end.",
    ].join("\n");

    const input = msgs.map((m) => ({ role: m.role, content: m.content }));

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
                  preferred_contact: {
                    anyOf: [
                      { type: "string", enum: ["email", "phone", "text"] },
                      { type: "null" },
                    ],
                  },
                },
                required: ["name", "email", "phone", "company", "website", "preferred_contact"],
              },
              next_question: { anyOf: [{ type: "string" }, { type: "null" }] },
              wants_follow_up: { type: "boolean" },
            },
            required: ["reply", "lead", "next_question", "wants_follow_up"],
          },
        },
      },
    } as any);

    const parsed = (response as any).output_parsed as ChatOutput | undefined;

    // Some OpenAI SDK builds don't populate `output_parsed` yet. If so, fall back to parsing `output_text`.
    const rawText: string = (response as any).output_text || "";
    let parsedFromText: ChatOutput | undefined = undefined;
    if (!parsed && rawText) {
      try {
        const candidate = JSON.parse(rawText);
        if (candidate && typeof candidate === "object") parsedFromText = candidate as ChatOutput;
      } catch {
        // ignore
      }
    }

    let out: ChatOutput;
    const effective = parsedFromText || parsed;

    if (effective && typeof effective.reply === "string" && (effective as any).lead) {
      out = effective as ChatOutput;
    } else {
      out = {
        reply: (response as any).output_text || "Thanks — how can we help?",
        lead: leadIn,
        next_question: null,
        wants_follow_up: false,
      };
    }

    // Merge lead: preserve existing when model returns null
    const mergedLead: Lead = {
      name: out.lead.name ?? leadIn.name,
      email: out.lead.email ?? leadIn.email,
      phone: out.lead.phone ?? leadIn.phone,
      company: out.lead.company ?? leadIn.company,
      website: out.lead.website ?? leadIn.website,
      preferred_contact: out.lead.preferred_contact ?? leadIn.preferred_contact,
    };

    const wants_follow_up = out.wants_follow_up || followUpDetected;

    // === Server-side enforcement: one-step follow-up collection ===
    // If follow-up is requested, we *override* the model with a strict sequence and never add extra questions.
    let reply = (out.reply || "").trim();
    let next_question: string | null = out.next_question;

    if (wants_follow_up) {
      // Step 1: Name
      if (!mergedLead.name) {
        reply = "Absolutely — what name should we use?";
        next_question = "What name should we use?";
      }
      // Step 2: Preferred contact method
      else if (!mergedLead.preferred_contact) {
        reply = `Thanks, ${mergedLead.name}. What’s your preferred contact method: email, phone call, or text?`;
        next_question = "What’s your preferred contact method: email, phone call, or text?";
      }
      // Step 3: Collect the needed detail based on method
      else if (mergedLead.preferred_contact === "email" && !mergedLead.email) {
        reply = `Great — what’s the best email to reach you at, ${mergedLead.name}?`;
        next_question = "What’s the best email to reach you at?";
      } else if ((mergedLead.preferred_contact === "phone" || mergedLead.preferred_contact === "text") && !mergedLead.phone) {
        reply = `Perfect — what phone number should we use for ${methodLabel(mergedLead.preferred_contact)}?`;
        next_question = "What phone number should we use?";
      } else {
        // Confirmation (NO QUESTION)
        const method = mergedLead.preferred_contact;
        const dest = method === "email" ? mergedLead.email : mergedLead.phone;
        reply = `Thank you, ${mergedLead.name}. We’ll reach out soon via ${methodLabel(method)} at ${dest}.`;
        next_question = null;
      }
    } else {
      // Non-follow-up flow: keep model's one-question behavior (if next_question exists, ensure it's appended once)
      if (next_question) {
        const q = next_question.trim();
        if (q && !reply.includes(q)) reply = reply ? `${reply}\n\n${q}` : q;
      }
    }

    const returnId = (response as any).id as string | undefined;

    // Send lead email to business inbox once we have contact details; avoid duplicates if client says already emailed.
    let emailed = false;
    const alreadyEmailed = !!emailedIn;
    if (!alreadyEmailed && wants_follow_up) {
      // Only email when we have enough to reach user according to preferred method
      const ready =
        (mergedLead.preferred_contact === "email" && !!mergedLead.email) ||
        ((mergedLead.preferred_contact === "phone" || mergedLead.preferred_contact === "text") && !!mergedLead.phone) ||
        (!mergedLead.preferred_contact && (!!mergedLead.email || !!mergedLead.phone));

      if (ready) {
        try {
          emailed = await maybeEmailLeadSummary({
            lead: mergedLead,
            conversationId,
            lastUserMessage: lastUser,
            reply,
            returnId,
          });
        } catch {
          emailed = false;
        }
      }
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
