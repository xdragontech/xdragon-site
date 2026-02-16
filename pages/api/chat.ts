import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { prisma } from "../../lib/prisma";

/**
 * Basic Upstash Redis rate limiting (fixed-window).
 * - Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env.
 * - If env vars are missing, rate limiting is skipped (no-op).
 */
function getClientIp(req: NextApiRequest): string {
  const xf = (req.headers["x-forwarded-for"] || "") as string;
  const first = xf.split(",")[0]?.trim();
  const ip =
    first ||
    (req.headers["x-real-ip"] as string) ||
    (req.headers["cf-connecting-ip"] as string) ||
    (req.socket.remoteAddress as string) ||
    "unknown";
  return ip;
}

async function upstashIncr(key: string): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const resp = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as { result?: number };
  return typeof data?.result === "number" ? data.result : null;
}

async function upstashExpire(key: string, ttlSeconds: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function upstashLpush(key: string, value: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/lpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function upstashLtrim(key: string, start: number, stop: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/ltrim/${encodeURIComponent(key)}/${start}/${stop}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

/**
 * Lightweight lead logging (backup trail beyond email).
 * Stores JSON events in Upstash Redis list keys:
 * - leadlog:contact
 * - leadlog:chat
 *
 * Keeps the latest 1000 events, TTL 90 days.
 */
async function logLeadEvent(kind: "contact" | "chat", payload: Record<string, unknown>): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const key = `leadlog:${kind}`;
  const entry = JSON.stringify(payload);

  await upstashLpush(key, entry);
  await upstashLtrim(key, 0, 999);
  await upstashExpire(key, 60 * 60 * 24 * 90);
}

type RateLimitConfig = {
  name: string; // route name
  perMinute: number;
  perHour: number;
};

async function enforceRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  cfg: RateLimitConfig
): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; // no-op if not configured

  const ip = getClientIp(req);

  const now = Date.now();
  const minuteWindow = Math.floor(now / 60_000);
  const hourWindow = Math.floor(now / 3_600_000);

  const minuteKey = `rl:${cfg.name}:m:${minuteWindow}:${ip}`;
  const hourKey = `rl:${cfg.name}:h:${hourWindow}:${ip}`;

  const minuteCount = await upstashIncr(minuteKey);
  if (minuteCount === 1) await upstashExpire(minuteKey, 60);

  const hourCount = await upstashIncr(hourKey);
  if (hourCount === 1) await upstashExpire(hourKey, 3600);

  const minuteExceeded = typeof minuteCount === "number" && minuteCount > cfg.perMinute;
  const hourExceeded = typeof hourCount === "number" && hourCount > cfg.perHour;

  if (minuteExceeded || hourExceeded) {
    const retryAfter = minuteExceeded ? 60 : 3600;
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      ok: false,
      error: "Rate limit exceeded. Please try again shortly.",
    } as any);
    return false;
  }

  return true;
}


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

function isValidEmail(email: string | null | undefined): boolean {
  const e = (email || "").trim();
  if (!e) return false;
  if (e.length < 6 || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(e);
}

function normalizeLead(input?: Partial<Lead> | null): Lead {
  const pc = input?.preferred_contact ?? null;
  const preferred_contact: PreferredContact | null =
    pc === "email" || pc === "phone" || pc === "text" ? pc : null;

  return {
    name: input?.name ?? null,
    email: (typeof input?.email === "string" ? input.email.trim().toLowerCase() : input?.email ?? null),
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


function hasInternationalHint(allText: string): boolean {
  const t = (allText || "").toLowerCase();

  // Signals that +1 default may be wrong.
  // Keep this conservative: only trigger when user clearly indicates a non-NA region.
  const nonNA = [
    // Most common for a Canada/US-based consulting firm with occasional international leads
    "uk", "united kingdom", "england", "scotland", "wales", "ireland", "london", "dublin",
    "australia", "sydney", "melbourne",
    "new zealand", "auckland",
    "europe", "eu", "european", "germany", "berlin", "france", "paris", "netherlands", "amsterdam",
    "sweden", "stockholm", "norway", "oslo", "denmark", "copenhagen", "finland", "helsinki",
    "india",
    "singapore", "hong kong",
    // Generic signals
    "international", "overseas", "outside canada", "outside the us", "outside the u.s.", "outside the united states",
    "gmt", "bst", "cet", "aest", "nzst"
  ];

  // If they explicitly say Canada/US, do not treat as international.
  if (/(canada|british columbia|bc|vancouver|burnaby|usa|u\.s\.a|united states|america)\b/.test(t)) return false;

  return nonNA.some((k) => t.includes(k));
}

function phoneNeedsCountryCode(phoneRaw: string | null, internationalHint: boolean): boolean {
  if (!internationalHint || !phoneRaw) return false;
  const trimmed = String(phoneRaw).trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("+")) return false;
  const digits = trimmed.replace(/[^\d]/g, "");
  // A 10-digit local number is ambiguous outside NANP.
  return digits.length === 10;
}

function methodLabel(m: PreferredContact) {
  if (m === "email") return "email";
  if (m === "phone") return "phone call";
  return "text";
}


function normalizePhone(raw: string | null, internationalHint: boolean): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;

  // North America default:
  // If the conversation suggests the user may be outside Canada/US, avoid assuming +1 for a 10-digit number.
  // - 10 digits => assume +1
  // - 11 digits starting with 1 => +1 + last 10
  // If user provided an international number (with +), keep digits as E.164-ish (+ + digits).
  if (digits.length === 10) {
    if (internationalHint && !hasPlus) return trimmed; // ask for country code later
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) return `+1${digits.slice(1)}`;
  if (hasPlus && digits.length >= 11 && digits.length <= 15) return `+${digits}`;

  // Fallback: if 12–15 digits, assume it already includes country code.
  if (digits.length >= 12 && digits.length <= 15) return `+${digits}`;

  // Unknown format; return original trimmed (better than dropping it)
  return trimmed;
}

function formatPhoneDisplay(e164: string | null): string | null {
  if (!e164) return null;
  const digits = e164.replace(/[^\d]/g, "");
  // Handle +1NXXNXXXXXX nicely
  if (digits.length === 11 && digits.startsWith("1")) {
    const a = digits.slice(1, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7);
    return `+1-${a}-${b}-${c}`;
  }
  if (e164.startsWith("+")) return e164;
  return `+${digits}`;
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
  const RESEND_TO_EMAIL =
    process.env.RESEND_TO_EMAIL ||
    process.env.CONTACT_TO_EMAIL ||
    process.env.CONTACT_TO ||
    "hello@xdragon.tech";
  const RESEND_FROM =
    process.env.RESEND_FROM_EMAIL ||
    process.env.RESEND_FROM ||
    process.env.CONTACT_FROM_EMAIL ||
    ""; // must be a verified sender, e.g. "X Dragon <noreply@xdragon.tech>"

  if (!RESEND_API_KEY || !RESEND_FROM) return false;

  // We can still notify our inbox even if contact info is incomplete/invalid.

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resend } = require("resend") as typeof import("resend");
  const resend = new Resend(RESEND_API_KEY);

  const who = args.lead.name || "New lead";
  const emailOk = isValidEmail(args.lead.email);
  const emailDisplay = args.lead.email ? (emailOk ? args.lead.email : `${args.lead.email} (invalid)`) : "n/a";
  const where =
    args.lead.preferred_contact
      ? `${methodLabel(args.lead.preferred_contact)}: ${
          args.lead.preferred_contact === "email" ? emailDisplay : (formatPhoneDisplay(args.lead.phone) || args.lead.phone || "n/a")
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
    `- Email: ${emailDisplay}`,
    `- Phone: ${formatPhoneDisplay(args.lead.phone) || args.lead.phone || "n/a"}`,
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
  if (args.lead.email) if (emailOk) payload.replyTo = args.lead.email;

  await resend.emails.send(payload);

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const _rlOk = await enforceRateLimit(req, res, { name: "chat", perMinute: 20, perHour: 200 });
  if (!_rlOk) return;

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
    const internationalHint = hasInternationalHint(msgs.map((m) => m.content).join(" \n"));
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content || "";
    const followUpDetected = looksLikeFollowUpIntent(lastUser);

    // If the conversation is already in the follow-up intake flow (e.g., user previously chose a contact method),
    // we should keep treating it as follow-up even if the most recent message is just the requested detail.
    const followUpModeFromLead =
      !!leadIn.preferred_contact ||
      (!!leadIn.name && (!!leadIn.email || !!leadIn.phone));


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

    // If the user typed an incomplete/invalid email, treat it as missing so we ask again.
    // Keep the raw value for notifying our inbox (without using it as replyTo).
    const invalidEmailAttempt =
      mergedLead.email && !isValidEmail(mergedLead.email) ? mergedLead.email : null;
    if (invalidEmailAttempt) mergedLead.email = null;

    // Normalize phone numbers to E.164-ish format for storage + emailing.
    mergedLead.phone = normalizePhone(mergedLead.phone, internationalHint);


    const wants_follow_up = out.wants_follow_up || followUpDetected || followUpModeFromLead;

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
        reply = invalidEmailAttempt
          ? `That email address looks incomplete (${invalidEmailAttempt}). What’s the full email to reach you at, ${mergedLead.name}?`
          : `Great — what’s the best email to reach you at, ${mergedLead.name}?`;
        next_question = "What’s the best email to reach you at?";
      } else if ((mergedLead.preferred_contact === "phone" || mergedLead.preferred_contact === "text") && !mergedLead.phone) {
        reply = `Perfect — what phone number should we use for ${methodLabel(mergedLead.preferred_contact)}?`;
        next_question = "What phone number should we use?";
      } else {
        // If we have a phone number but it may be international without a country code, ask for country code (one question).
        if (phoneNeedsCountryCode(mergedLead.phone, internationalHint)) {
          reply = `Thanks, ${mergedLead.name}. What country code should we use for that number? (e.g., +44, +61)`;
          next_question = "What country code should we use? (e.g., +44, +61)";
        } else {
          // Confirmation (NO QUESTION)

        const method = mergedLead.preferred_contact;
        const dest = method === "email" ? mergedLead.email : (formatPhoneDisplay(mergedLead.phone) || mergedLead.phone);
        reply = `Thank you, ${mergedLead.name}. We’ll reach out soon via ${methodLabel(method)} at ${dest}.`;
          next_question = null;
        }
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
      const hasInvalidEmailAttempt = !!invalidEmailAttempt;
      const validReady =
        (mergedLead.preferred_contact === "email" && isValidEmail(mergedLead.email)) ||
        ((mergedLead.preferred_contact === "phone" || mergedLead.preferred_contact === "text") && !!mergedLead.phone) ||
        (!mergedLead.preferred_contact && (isValidEmail(mergedLead.email) || !!mergedLead.phone));

      // If user attempted an email but it is invalid, notify our inbox (but keep `emailed` false so we can email again once valid).
      if (hasInvalidEmailAttempt && mergedLead.preferred_contact === "email" && !mergedLead.phone) {
        try {
          await maybeEmailLeadSummary({
            lead: { ...mergedLead, email: invalidEmailAttempt },
            conversationId,
            lastUserMessage: lastUser,
            reply,
            returnId,
          });
        } catch (e) {
          console.error("Resend send failed (invalid email attempt)", e);
        }
      }

      // Only email when we have enough to reach user according to preferred method
      if (validReady) {
        try {
          emailed = await maybeEmailLeadSummary({
            lead: mergedLead,
            conversationId,
            lastUserMessage: lastUser,
            reply,
            returnId,
          });
        } catch (e) {
          // Surface errors in Vercel function logs for debugging.
          console.error("Resend send failed", e);
          emailed = false;
        }
      }
    }


    // Backup lead log (only when we have meaningful lead info / follow-up intent).
    const shouldLogLead =
      Boolean(wants_follow_up) ||
      Boolean(mergedLead.email) ||
      Boolean(mergedLead.phone) ||
      Boolean(mergedLead.company) ||
      Boolean(mergedLead.website) ||
      Boolean(mergedLead.name);

    if (shouldLogLead) {
      // Source-of-truth lead record in Postgres: 1 row per conversation (keyed by conversationId).
      // Best-effort: do not fail the request if DB write fails.
      try {
        const cid = typeof conversationId === "string" ? conversationId.trim() : "";
        const ip = getClientIp(req);
        const userAgent = String(req.headers["user-agent"] || "");
        const referer = String(req.headers["referer"] || "");

          const payload = {
            conversationId: cid || null,
            returnId,
            lead: mergedLead,
            wants_follow_up,
            next_question,
            lastUserMessage: lastUser,
            reply,
            emailed,
            ip,
            userAgent,
            referer,
            lastSeenAt: new Date().toISOString(),
          };

        if (cid) {
            // Find by payload.conversationId (avoids requiring a dedicated DB column).
            const existing = await prisma.lead.findFirst({
              where: {
                source: "CHAT",
                payload: {
                  path: ["conversationId"],
                  equals: cid,
                },
              },
              orderBy: { createdAt: "desc" },
            });

            if (existing?.id) {
              await prisma.lead.update({
                where: { id: existing.id },
                data: {
                  name: mergedLead.name || null,
                  email: mergedLead.email || null,
                  ip,
                  userAgent,
                  payload,
                },
              });
            } else {
              await prisma.lead.create({
                data: {
                  source: "CHAT",
                  name: mergedLead.name || null,
                  email: mergedLead.email || null,
                  ip,
                  userAgent,
                  payload,
                },
              });
            }
          } else {
            // No conversationId — still persist a row for visibility.
            await prisma.lead.create({
              data: {
                source: "CHAT",
                name: mergedLead.name || null,
                email: mergedLead.email || null,
                ip,
                userAgent,
                payload,
              },
            });
          }
      } catch (e) {
        console.error("Chat lead DB write failed", e);
      }

      await logLeadEvent("chat", {
        ts: new Date().toISOString(),
        ip: getClientIp(req),
        ua: String(req.headers["user-agent"] || ""),
        referer: String(req.headers["referer"] || ""),
        conversationId: req.body?.conversationId || null,
        returnId,
        lead: mergedLead,
        wants_follow_up,
        next_question,
        lastUserMessage: lastUser,
        reply,
        emailed,
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