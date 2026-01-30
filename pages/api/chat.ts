import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

type ChatRole = "user" | "assistant";

type IncomingMessage = {
  role: ChatRole;
  content: string;
};

type Lead = {
  // Always present in structured output (may be empty strings)
  name: string;
  email: string;
  phone: string;
  company: string;
  intent: "ai_strategy" | "infrastructure" | "automation" | "other";
  platform: string;
  goal: string;
};

type ApiResponse =
  | { ok: true; reply: string; lead: Lead; returnId?: string; emailed: boolean }
  | { ok: false; error: string };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function normalizeMessages(raw: any): IncomingMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      out.push({ role, content });
    }
  }
  return out;
}

function mergeLead(existing: any, incoming: any): Lead {
  const fallback: Lead = {
    name: "",
    email: "",
    phone: "",
    company: "",
    intent: "other",
    platform: "",
    goal: "",
  };

  const safeExisting = (existing && typeof existing === "object") ? existing : {};
  const safeIncoming = (incoming && typeof incoming === "object") ? incoming : {};

  const intent = (safeIncoming.intent || safeExisting.intent || fallback.intent) as Lead["intent"];
  const normalizedIntent: Lead["intent"] =
    intent === "ai_strategy" || intent === "infrastructure" || intent === "automation" || intent === "other"
      ? intent
      : "other";

  return {
    name: asString(safeIncoming.name || safeExisting.name || fallback.name),
    email: asString(safeIncoming.email || safeExisting.email || fallback.email),
    phone: asString(safeIncoming.phone || safeExisting.phone || fallback.phone),
    company: asString(safeIncoming.company || safeExisting.company || fallback.company),
    intent: normalizedIntent,
    platform: asString(safeIncoming.platform || safeExisting.platform || fallback.platform),
    goal: asString(safeIncoming.goal || safeExisting.goal || fallback.goal),
  };
}

function shouldTriggerFollowupEmail(messages: IncomingMessage[], lead: Lead) {
  // Only trigger when we have a usable email AND the user asked for a follow-up / contact.
  const hasEmail = !!lead.email && lead.email.includes("@");
  if (!hasEmail) return false;

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.toLowerCase() || "";

  const intentSignals = [
    "contact",
    "call me",
    "email me",
    "follow up",
    "book",
    "consult",
    "consultation",
    "get started",
    "pricing",
    "quote",
    "talk to",
    "speak to",
  ];

  return intentSignals.some((s) => lastUser.includes(s));
}

async function sendResendEmail(params: { to: string; from: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: params.to,
      from: params.from,
      subject: params.subject,
      html: params.html,
    }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (json && (json.message || json.error)) ? (json.message || json.error) : "Resend send failed";
    throw new Error(msg);
  }
  return json as { id?: string };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTranscriptHtml(conversationId: string, messages: IncomingMessage[]) {
  const lines = messages
    .slice(-12)
    .map((m) => `<div style="margin:6px 0;"><strong>${m.role === "user" ? "User" : "Assistant"}:</strong> ${escapeHtml(m.content)}</div>`)
    .join("");
  return `
    <div style="font-family: ui-sans-serif, system-ui; line-height:1.4;">
      <h2 style="margin:0 0 8px;">New chat lead</h2>
      <div style="color:#555; font-size:12px; margin-bottom:12px;">Conversation: ${escapeHtml(conversationId)}</div>
      ${lines}
    </div>
  `;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const conversationId = asString(req.body?.conversationId) || "unknown";
    const messages = normalizeMessages(req.body?.messages);
    const leadIn = req.body?.lead || {};

    if (!messages.length) return res.status(400).json({ ok: false, error: "No messages provided" });

    // Detect first meaningful user turn (widget includes a greeting assistant message by default)
    const userCount = messages.filter((m) => m.role === "user").length;
    const isFirstUserTurn = userCount <= 1;

    const systemInstructions = `
You are the website chat assistant for X Dragon Technologies.

Goal:
- Help startups through medium-sized businesses with AI consulting, infrastructure management, and automation/data pipelines.
- Be confident, practical, and ROI-focused.
- DO NOT mention competitors or compare against specific firms.

Critical conversation rules:
1) Ask ONE question at a time (exactly one question mark in your reply).
2) Keep replies concise: 2–6 sentences, then the single question.
3) If the user requests a follow-up, ask for name + email ONLY if missing.
4) If name+email are present, confirm you’ll follow up (no more questions unless necessary).

Routing (first user turn):
- Infer the user’s intent from their message: ai_strategy | infrastructure | automation | other.
- Ask one targeted question to route the conversation:
  - ai_strategy: ask about the business goal (e.g., growth, CX, cost reduction) or key process.
  - infrastructure: ask about platform/hosting + current pain (uptime, speed, scale).
  - automation: ask what workflow is manual + which tools they use.
  - other: ask what outcome they want.

Structured output:
- Return JSON per the provided schema with:
  - reply: your assistant reply
  - lead: update fields if learned (use empty string if unknown)
`;

    // Build model input (use developer role to avoid SDK typing issues)
    const input: any[] = messages.map((m) => ({ role: m.role, content: m.content }));

    // Provide context to the model (lead + first-turn flag)
    input.unshift({
      role: "developer",
      content: `${systemInstructions}\n\nFirst user turn: ${isFirstUserTurn ? "yes" : "no"}\nKnown lead details (may be empty): ${JSON.stringify(leadIn || {})}`,
    });

    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      input,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "xdragon_chat",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply: { type: "string" },
              lead: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  company: { type: "string" },
                  intent: { type: "string", enum: ["ai_strategy", "infrastructure", "automation", "other"] },
                  platform: { type: "string" },
                  goal: { type: "string" },
                },
                required: ["name", "email", "phone", "company", "intent", "platform", "goal"],
              },
            },
            required: ["reply", "lead"],
          },
        },
      },
    });

    const text = response.output_text || "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const reply = asString(parsed?.reply) || "Got it. What outcome are you aiming for right now?";
    const lead = mergeLead(leadIn, parsed?.lead);

    const emailedAlready = !!req.body?.emailed; // optional; client may send
    let emailed = false;
    let returnId: string | undefined = response.id;

    // Trigger email only when asked and not already emailed
    if (!emailedAlready && shouldTriggerFollowupEmail(messages, lead)) {
      const to = process.env.RESEND_TO || "hello@xdragon.tech";
      const from = process.env.RESEND_FROM || "X Dragon <hello@xdragon.tech>";

      const subject = `X Dragon chat lead: ${lead.name || "New lead"} (${lead.intent})`;
      const html = buildTranscriptHtml(conversationId, messages);

      try {
        await sendResendEmail({ to, from, subject, html });
        emailed = true;
      } catch (e) {
        // If email fails, we still return chat reply; UI can handle emailed=false
        emailed = false;
      }
    }

    return res.status(200).json({ ok: true, reply, lead, returnId, emailed });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
