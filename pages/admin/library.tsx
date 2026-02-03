// pages/admin/library.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";

type PromptStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type PromptRow = {
  id: string;
  title: string;
  description?: string | null;
  content: string;
  status: PromptStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
  categoryId?: string | null;
};

type ApiOk = { ok: true; prompts: PromptRow[] };
type ApiErr = { ok: false; error: string };
type ApiResp = ApiOk | ApiErr;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  // Only allow ACTIVE admin users
  const role = (session as any)?.role as string | undefined;
  const status = (session as any)?.status as string | undefined;

  if (!session?.user || role !== "ADMIN" || status === "BLOCKED") {
    const callbackUrl = encodeURIComponent("/admin/library");
    return {
      redirect: {
        destination: `/admin/signin?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }

  return { props: {} };
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function StatusPill({ status }: { status: PromptStatus }) {
  const cls =
    status === "PUBLISHED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "ARCHIVED"
      ? "border-neutral-200 bg-neutral-100 text-neutral-700"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", cls)}>{status}</span>;
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function AdminLibraryPage(_props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const isDashboard = router.pathname === "/admin/users";
  const isLibrary = router.pathname === "/admin/library";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [prompts, setPrompts] = useState<PromptRow[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromptRow | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PromptStatus>("DRAFT");
  const [content, setContent] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return prompts;
    return prompts.filter((p) => {
      const hay = `${p.title} ${p.description || ""} ${p.status} ${p.content}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q, prompts]);

  function openNew() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setStatus("DRAFT");
    setContent("");
    setModalOpen(true);
  }

  function openEdit(p: PromptRow) {
    setEditing(p);
    setTitle(p.title || "");
    setDescription(p.description || "");
    setStatus(p.status || "DRAFT");
    setContent(p.content || "");
    setModalOpen(true);
  }

  async function loadPrompts() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/library/prompts?q=${encodeURIComponent(q.trim())}`, {
        method: "GET",
        credentials: "include",
      });
      const j = (await r.json().catch(() => null)) as ApiResp | null;
      if (!r.ok || !j || (j as any).ok !== true) throw new Error((j as any)?.error || "Failed to load prompts");
      setPrompts((j as ApiOk).prompts || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => void loadPrompts(), []); // initial

  async function savePrompt() {
    setErr(null);
    setMsg(null);

    const t = title.trim();
    const c = content.trim();
    if (!t) return setErr("Title is required.");
    if (!c) return setErr("Content is required.");

    setBusy(true);
    try {
      const body = { title: t, description: description.trim() || null, status, content: c };
      const url = editing ? `/api/admin/library/prompts/${encodeURIComponent(editing.id)}` : "/api/admin/library/prompts";
      const method = editing ? "PUT" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Save failed");

      setModalOpen(false);
      setEditing(null);
      setMsg(editing ? "Prompt updated." : "Prompt created.");
      await loadPrompts();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deletePrompt(p: PromptRow) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;

    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/library/prompts/${encodeURIComponent(p.id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Delete failed");
      setMsg("Prompt deleted.");
      await loadPrompts();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>X Dragon Command — Library</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-start">
              <img src="/logo.png" alt="X Dragon logo" className="h-11 w-auto" />
              <div
                className="mt-1 font-semibold leading-none text-neutral-900"
                style={{ fontFamily: "Orbitron, ui-sans-serif, system-ui", fontSize: "1.6875rem" }}
              >
                Command
              </div>
            </div>
            <div className="flex h-11 items-center">
              <div className="text-sm text-neutral-600">Library</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => signOut({ callbackUrl: "/admin/signin" })}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              <nav className="space-y-2">
                <Link
                  href="/admin/users"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors" +
                    (isDashboard ? " ring-2 ring-neutral-900/20" : "")
                  }
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/library"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors" +
                    (isLibrary ? " ring-2 ring-neutral-900/20" : "")
                  }
                >
                  Library
                </Link>
              </nav>
            </div>
          </aside>

          <section className="lg:col-span-10">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-lg font-semibold">Prompt Library</h1>
                  <p className="mt-1 text-sm text-neutral-600">Create, edit, and delete prompts shown in the gated /tools library.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadPrompts()}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    disabled={busy}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={openNew}
                    className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                    disabled={busy}
                  >
                    New prompt
                  </button>
                </div>
              </div>

              {(err || msg) && (
                <div className="mt-4 space-y-2">
                  {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}
                  {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title, description, status, content…"
                  className="w-full sm:w-[520px] rounded-xl bg-white border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                />
                <div className="text-sm text-neutral-500">{loading ? "Loading…" : `${filtered.length} prompt${filtered.length === 1 ? "" : "s"}`}</div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Updated</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-6 text-neutral-500" colSpan={4}>
                          Loading…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-neutral-500" colSpan={4}>
                          No prompts found.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((p) => (
                        <tr key={p.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-neutral-900">{p.title}</div>
                            {p.description ? <div className="mt-0.5 text-xs text-neutral-500">{p.description}</div> : null}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill status={p.status} />
                          </td>
                          <td className="px-4 py-3 text-neutral-700">{fmtDate(p.updatedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(p)}
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                                disabled={busy}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deletePrompt(p)}
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                                disabled={busy}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                Tip: Keep titles short and descriptive. “Content” should be the exact prompt text used in /tools.
              </div>
            </div>
          </section>
        </div>
      </main>

      <Modal
        open={modalOpen}
        title={editing ? "Edit prompt" : "New prompt"}
        onClose={() => {
          if (busy) return;
          setModalOpen(false);
          setEditing(null);
        }}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="text-xs font-semibold text-neutral-700">Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                placeholder="e.g., Cold outreach email generator"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-neutral-700">Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PromptStatus)}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-semibold text-neutral-700">Description (optional)</div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              placeholder="One-liner shown in the list"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-neutral-700">Content</div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 h-56 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              placeholder="Paste the prompt text here…"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void savePrompt()}
              className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
