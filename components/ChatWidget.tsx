import React, { useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type Lead = {
  name?: string;
  email?: string;
};

type ChatResponse = {
  ok: boolean;
  reply?: string;
  lead?: Lead;
  returnId?: string;
  emailed?: boolean;
  error?: string;
};

const LS_KEY = "xdragon_chat_state_v2";
const LS_EMAIL_SENT_KEY = "xdragon_chat_email_sent_v1";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isChatRole(v: any): v is ChatRole {
  return v === "user" || v === "assistant";
}

function coerceMessages(v: any): ChatMessage[] | null {
  if (!Array.isArray(v)) return null;
  const out: ChatMessage[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    if (!isChatRole((item as any).role)) continue;
    if (typeof (item as any).content !== "string") continue;
    out.push({ role: (item as any).role, content: (item as any).content });
  }
  return out.length ? out : null;
}

function isValidEmail(email: string) {
  const e = (email || "").trim();
  if (e.length < 6 || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(e);
}

function makeConversationId() {
  return "conv_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi — I’m the X Dragon assistant. Tell me what you’re trying to improve (revenue, reliability, speed, automation), and I’ll point you in the right direction.",
  },
];

export default function ChatWidget() {
  const [mounted, setMounted] = useState(false);

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Chat state
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [lead, setLead] = useState<Lead>({});
  const [emailed, setEmailed] = useState<boolean>(false);

  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "thinking" | "error">("idle");
  const [errorText, setErrorText] = useState<string>("");

  // Lead capture prompt state
  const [showLeadPrompt, setShowLeadPrompt] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);

  // Mount + restore persisted state (client-only)
  useEffect(() => {
    setMounted(true);

    const saved = safeJsonParse<{
      conversationId?: string;
      messages?: any;
      lead?: Lead;
      emailed?: boolean;
      isOpen?: boolean;
      isMinimized?: boolean;
    }>(localStorage.getItem(LS_KEY));

    const savedEmailed = localStorage.getItem(LS_EMAIL_SENT_KEY) === "1";

    const cid = saved?.conversationId ? saved.conversationId : makeConversationId();
    setConversationId(cid);

    const coerced = coerceMessages(saved?.messages);
    if (coerced) setMessages(coerced);

    if (saved?.lead) setLead(saved.lead);
    if (typeof saved?.emailed === "boolean") setEmailed(saved.emailed || savedEmailed);
    else setEmailed(savedEmailed);

    if (typeof saved?.isOpen === "boolean") setIsOpen(saved.isOpen);
    if (typeof saved?.isMinimized === "boolean") setIsMinimized(saved.isMinimized);
  }, []);

  // Persist state
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ conversationId, messages, lead, emailed, isOpen, isMinimized })
    );
    if (emailed) localStorage.setItem(LS_EMAIL_SENT_KEY, "1");
  }, [mounted, conversationId, messages, lead, emailed, isOpen, isMinimized]);

  // Auto-scroll
  useEffect(() => {
    if (!mounted) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mounted, messages, status, showLeadPrompt]);

  const canSubmit = useMemo(() => input.trim().length > 0 && status !== "thinking", [input, status]);

  const leadEmailTrim = useMemo(() => leadEmail.trim(), [leadEmail]);
  const leadEmailValid = useMemo(() => (leadEmailTrim ? isValidEmail(leadEmailTrim) : false), [leadEmailTrim]);
  const leadEmailError = useMemo(() => {
    if (!showLeadPrompt) return "";
    if (!leadEmailTrim) return "";
    return leadEmailValid ? "" : "Please enter a valid email (e.g. name@domain.com).";
  }, [showLeadPrompt, leadEmailTrim, leadEmailValid]);

  async function sendToApi(nextMessages: ChatMessage[], nextLead: Lead) {
    setStatus("thinking");
    setErrorText("");

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: nextMessages,
          lead: nextLead || {},
        }),
      });

      const data: ChatResponse = await resp.json().catch(() => ({ ok: false, error: "Bad JSON" }));
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Chat request failed");
      }

      const reply = data.reply || "Got it.";
      setMessages([...nextMessages, { role: "assistant", content: reply }]);

      if (data.lead) setLead((prev) => ({ ...prev, ...data.lead }));
      if (data.emailed) setEmailed(true);

      setStatus("idle");
    } catch (err: any) {
      setStatus("error");
      setErrorText(err?.message || "Something went wrong. Please try again.");
    }
  }

  async function onSend() {
    const trimmed = input.trim();
    if (!trimmed || status === "thinking") return;

    setInput("");

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);

    await sendToApi(nextMessages, lead);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function openLeadCapture() {
    if (emailed) return;
    setLeadName(lead.name || "");
    setLeadEmail(lead.email || "");
    setShowLeadPrompt(true);
    setIsOpen(true);
    setIsMinimized(false);
  }

  async function submitLeadCapture() {
    const name = leadName.trim();
    const email = leadEmail.trim().toLowerCase();
    if (!name || !email) return;
    if (!isValidEmail(email)) {
      setErrorText("Please enter a valid email address.");
      return;
    }

    const nextLead: Lead = { ...lead, name, email };
    setLead(nextLead);
    setShowLeadPrompt(false);

    const followUpMsg =
      "I'd like a follow-up. My name is " +
      name +
      " and my email is " +
      email +
      ". Please have someone contact me.";

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: followUpMsg }];
    setMessages(nextMessages);

    await sendToApi(nextMessages, nextLead);
  }

  function resetConversation() {
    const freshId = makeConversationId();
    setConversationId(freshId);
    setLead({});
    setEmailed(false);
    localStorage.removeItem(LS_EMAIL_SENT_KEY);
    setMessages(INITIAL_MESSAGES);
    setInput("");
    setStatus("idle");
    setErrorText("");
    setShowLeadPrompt(false);
  }

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      {/* Launcher */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="group inline-flex items-center gap-3 rounded-2xl bg-black text-white px-4 py-3 shadow-lg hover:opacity-95"
          aria-label="Open chat"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M4 4h16v12H7l-3 3V4zm4 5h8v2H8V9zm0-4h12v2H8V5zm0 8h6v2H8v-2z" />
            </svg>
          </span>
          <div className="text-left">
            <div className="text-sm font-semibold leading-tight">Chat with X Dragon</div>
            <div className="text-xs text-white/75 leading-tight">Get answers or request a callback</div>
          </div>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-black text-white grid place-items-center text-sm font-bold">
                XD
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">X Dragon Assistant</div>
                <div className="text-xs text-neutral-500">
                  {status === "thinking" ? "Thinking…" : emailed ? "Follow-up requested ✅" : "AI + infra help"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                className="rounded-xl border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50"
                onClick={() => setIsMinimized((v) => !v)}
                aria-label={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? "Expand" : "Minimize"}
              </button>
              <button
                className="rounded-xl border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                Close
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div ref={listRef} className="max-h-[55vh] overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((m, idx) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={[
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                          isUser ? "bg-black text-white" : "bg-neutral-100 text-neutral-900",
                        ].join(" ")}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })}

                {status === "thinking" && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-neutral-400 animate-pulse" />
                        Working…
                      </span>
                    </div>
                  </div>
                )}

                {status === "error" && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {errorText || "Something went wrong."}
                  </div>
                )}

                {showLeadPrompt && !emailed && (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="text-sm font-semibold">Request a follow-up</div>
                    <div className="mt-1 text-xs text-neutral-600">
                      Share your email and we’ll route this to a human. (No spam.)
                    </div>

                    <div className="mt-3 grid gap-2">
                      <input
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="Name"
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                      />
                      <input
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        placeholder="Email"
                        type="email"
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black {leadEmailError ? "border-red-400 focus:ring-red-200" : ""}"
                      />

                      
                      {leadEmailError ? (
                        <div className="text-xs text-red-600">{leadEmailError}</div>
                      ) : null}
<div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowLeadPrompt(false)}
                          className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={submitLeadCapture}
                          className="flex-1 rounded-xl bg-black text-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
                          disabled={!leadName.trim() || !leadEmail.trim() || !leadEmailValid || status === "thinking"}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="border-t border-neutral-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Ask about AI, infrastructure, automation…"
                    className="flex-1 rounded-2xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                  />
                  <button
                    onClick={onSend}
                    disabled={!canSubmit}
                    className="rounded-2xl bg-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    Send
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openLeadCapture}
                      disabled={emailed}
                      className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {emailed ? "Follow-up requested" : "Request follow-up"}
                    </button>

                    <button
                      type="button"
                      onClick={resetConversation}
                      className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="text-[11px] text-neutral-500">
                    {conversationId ? `ID: ${conversationId.slice(-8)}` : ""}
                  </div>
                </div>
              </div>
            </>
          )}

          {isMinimized && (
            <div className="px-4 py-3">
              <button
                className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold hover:opacity-95"
                onClick={() => setIsMinimized(false)}
              >
                Open chat
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
