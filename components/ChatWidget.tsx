import React, { useEffect, useMemo, useRef, useState } from "react";

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

type ChatApiResponse = {
  ok: boolean;
  reply?: string;
  lead?: Lead;
  returnId?: string;
  error?: string;
};

const DEFAULT_GREETING =
  "Hi — I’m the X Dragon assistant. Ask me anything about AI consulting, infrastructure management, or automation. If you’d like, I can also help you scope a project and connect you with our team.";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: DEFAULT_GREETING },
  ]);

  const [lead, setLead] = useState<Lead>({});
  const [draft, setDraft] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);

  const conversationId = useMemo(() => {
    return (
      (typeof window !== "undefined" && (window.crypto?.randomUUID?.() || null)) ||
      `c_${Math.random().toString(36).slice(2)}`
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(
      () => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }),
      50
    );
    return () => clearTimeout(t);
  }, [open, messages.length]);

  async function sendMessage() {
    const trimmed = draft.trim();
    if (!trimmed || busy) return;

    setError(null);
    setBusy(true);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setDraft("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: nextMessages,
          lead,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      const data = (await res.json()) as ChatApiResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      if (data.lead) setLead((prev) => ({ ...prev, ...data.lead }));
      if (data.reply) setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[60]">
        <button
          onClick={() => setOpen((v) => !v)}
          className="group inline-flex items-center gap-3 rounded-2xl border border-neutral-300 bg-white px-4 py-3 shadow-lg hover:shadow-xl transition"
          aria-label={open ? "Close chat" : "Open chat"}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-black text-white">
            {open ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.31 6.3-6.31z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M4 4h16v12H5.17L4 17.17V4zm2 2v8h12V6H6zm2 10h10v2H8v-2z" />
              </svg>
            )}
          </span>

          <div className="text-left">
            <div className="text-sm font-semibold text-neutral-900">Chat with X Dragon</div>
            <div className="text-xs text-neutral-600">{open ? "We’re here." : "AI + Infra questions? Ask away."}</div>
          </div>

          <span className="ml-2 hidden sm:inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
            Online
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed bottom-24 right-5 z-[60] w-[92vw] max-w-md">
          <div className="rounded-3xl border border-neutral-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-200 bg-white/90 backdrop-blur">
              <div>
                <div className="text-sm font-semibold">X Dragon Assistant</div>
                <div className="text-xs text-neutral-500">Answers FAQs • Qualifies leads • Books next steps</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            <div ref={listRef} className="max-h-[55vh] overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, idx) => (
                <div key={idx} className={["flex", m.role === "user" ? "justify-end" : "justify-start"].join(" ")}>
                  <div
                    className={[
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "user" ? "bg-black text-white" : "bg-neutral-100 text-neutral-900",
                    ].join(" ")}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="bg-neutral-100 text-neutral-700 rounded-2xl px-4 py-3 text-sm">Typing…</div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  className="min-h-[44px] max-h-40 flex-1 resize-none rounded-2xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Ask a question…"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={busy || !draft.trim()}
                  className="rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  Send
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-neutral-500">
                  Don’t share sensitive info. We’ll only ask for contact details if you want follow-up.
                </div>
                <button
                  onClick={() => {
                    setMessages([{ role: "assistant", content: DEFAULT_GREETING }]);
                    setLead({});
                    setError(null);
                  }}
                  className="text-[11px] font-semibold text-neutral-700 hover:text-black"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
