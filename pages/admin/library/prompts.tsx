// pages/admin/library/prompts.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { authOptions } from "../../api/auth/[...nextauth]";
import AdminHeader from "../../../components/admin/AdminHeader";
import AdminSidebar from "../../../components/admin/AdminSidebar";

type PromptStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number | null;
  createdAt?: string | null;
};

type PromptRow = {
  id: string;
  title: string;
  description?: string | null;
  content: string;
  status: PromptStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
  categoryId?: string | null;
  category?: CategoryRow | null;
};

type ApiOkPrompts = { ok: true; prompts: PromptRow[] };
type ApiOkCats = { ok: true; categories: CategoryRow[] };
type ApiErr = { ok: false; error: string };

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  // Only allow ACTIVE admin users
  const role = (session as any)?.role as string | undefined;
  const status = (session as any)?.status as string | undefined;

  if (!session?.user || role !== "ADMIN" || status === "BLOCKED") {
    const callbackUrl = encodeURIComponent("/admin/library/prompts");
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
            Close
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function SmallModal({
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
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
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

  const [loggedInAs, setLoggedInAs] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        const email = (s?.user?.email || "").toString();
        const username = email ? email.split("@")[0] : "";
        setLoggedInAs(username);
      })
      .catch(() => {});
  }, []);

  const isDashboard = router.pathname === "/admin/dashboard";
  const isAccounts = router.pathname === "/admin/accounts";
  const isLibrary = router.pathname.startsWith("/admin/library");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PromptStatus>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL"); // categoryId

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);

  // Prompt modal state
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromptRow | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PromptStatus>("DRAFT");
  const [content, setContent] = useState("");
  const [promptCategoryId, setPromptCategoryId] = useState<string>(""); // "" = uncategorized

  // Category modal state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<CategoryRow | null>(null);
  const [catName, setCatName] = useState("");

  const filteredPrompts = useMemo(() => {
    const s = q.trim().toLowerCase();

    return prompts.filter((p) => {
      const inQ =
        !s ||
        p.title.toLowerCase().includes(s) ||
        (p.description || "").toLowerCase().includes(s) ||
        p.content.toLowerCase().includes(s);

      const inStatus = statusFilter === "ALL" ? true : p.status === statusFilter;

      const inCat =
        categoryFilter === "ALL"
          ? true
          : categoryFilter === "NONE"
          ? !p.categoryId
          : p.categoryId === categoryFilter;

      return inQ && inStatus && inCat;
    });
  }, [q, prompts, statusFilter, categoryFilter]);

  function openNewPrompt() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setStatus("DRAFT");
    setContent("");
    setPromptCategoryId("");
    setPromptModalOpen(true);
  }

  function openEditPrompt(p: PromptRow) {
    setEditing(p);
    setTitle(p.title || "");
    setDescription(p.description || "");
    setStatus(p.status || "DRAFT");
    setContent(p.content || "");
    setPromptCategoryId(p.categoryId || "");
    setPromptModalOpen(true);
  }

  function openNewCategory() {
    setCatEditing(null);
    setCatName("");
    setCatModalOpen(true);
  }

  function openEditCategory(c: CategoryRow) {
    setCatEditing(c);
    setCatName(c.name || "");
    setCatModalOpen(true);
  }

  async function loadCategories() {
    const r = await fetch("/api/admin/library/categories", { method: "GET", credentials: "include" });
    const j = (await r.json().catch(() => null)) as ApiOkCats | ApiErr | null;
    if (!r.ok || !j || (j as any).ok !== true) throw new Error((j as any)?.error || "Failed to load categories");
    setCategories((j as ApiOkCats).categories || []);
  }

  async function loadPrompts() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      // Server supports q, but we do client filtering too. Still pass q for scalability.
      const r = await fetch(`/api/admin/library/prompts?q=${encodeURIComponent(q.trim())}`, {
        method: "GET",
        credentials: "include",
      });
      const j = (await r.json().catch(() => null)) as ApiOkPrompts | ApiErr | null;
      if (!r.ok || !j || (j as any).ok !== true) throw new Error((j as any)?.error || "Failed to load prompts");
      setPrompts((j as ApiOkPrompts).prompts || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }

  async function loadAll() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadPrompts()]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load library data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => void loadAll(), []); // initial

  async function savePrompt() {
    setErr(null);
    setMsg(null);

    const t = title.trim();
    const c = content.trim();
    if (!t) return setErr("Title is required.");
    if (!c) return setErr("Content is required.");

    setBusy(true);
    try {
      const body = {
        title: t,
        description: description.trim() || null,
        status,
        content: c,
        categoryId: promptCategoryId ? promptCategoryId : null,
      };

      const url = editing ? `/api/admin/library/prompts/${encodeURIComponent(editing.id)}` : "/api/admin/library/prompts";
      const method = editing ? "PUT" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Save failed");

      setPromptModalOpen(false);
      setEditing(null);
      setMsg(editing ? "Prompt updated." : "Prompt created.");
      await loadAll();
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
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory() {
    setErr(null);
    setMsg(null);

    const name = catName.trim();
    if (!name) return setErr("Category name is required.");

    setBusy(true);
    try {
      const isEdit = Boolean(catEditing);
      const url = isEdit
        ? `/api/admin/library/categories/${encodeURIComponent(catEditing!.id)}`
        : "/api/admin/library/categories";
      const method = isEdit ? "PUT" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Save failed");

      setCatModalOpen(false);
      setCatEditing(null);
      setMsg(isEdit ? "Category updated." : "Category created.");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(c: CategoryRow) {
    if (!confirm(`Delete category "${c.name}"? Prompts will become Uncategorized.`)) return;

    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/library/categories/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Delete failed");

      // If currently filtering by this category, reset
      if (categoryFilter === c.id) setCategoryFilter("ALL");

      setMsg("Category deleted.");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const categoryOptions = useMemo(() => {
    const sorted = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    return sorted;
  }, [categories]);

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
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-start">
                <img src="/logo.png" alt="X Dragon logo" className="h-11 w-auto" />
                <div
                  className="mt-1 font-semibold leading-none text-neutral-900"
                  style={{ fontFamily: "Orbitron, ui-sans-serif, system-ui", fontSize: "1.6875rem" }}
                  Command
                </div>
              </div>

              <div className="flex h-11 items-center">
                <div className="text-sm text-neutral-600">Library</div>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <button
                onClick={() => signOut({ callbackUrl: "/admin/signin" })}
                className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                Sign out
              </button>
              {loggedInAs ? (
                <div className="mt-2 text-sm text-neutral-600">Logged in as: {loggedInAs}</div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              <nav className="space-y-2">
                <Link
                  href="/admin/dashboard"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors" +
                    (isDashboard ? " ring-2 ring-neutral-900/20" : "")
                  }
                  Dashboard
                </Link>
                
                <Link
                  href="/admin/accounts"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors" +
                    (isAccounts ? " ring-2 ring-neutral-900/20" : "")
                  }
                  Accounts
                </Link>
<Link
                  href="/admin/library"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors" +
                    (isLibrary ? " ring-2 ring-neutral-900/20" : "")
                  }
                  Library
                </Link>
              </nav>
            </div>
          </aside>

          <section className="lg:col-span-10">
            {(err || msg) && (
              <div className="mb-4 space-y-2">
                {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}
                {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Categories */}
              <div className="lg:col-span-4">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">Categories</div>
                      <div className="mt-1 text-xs text-neutral-500">Manage categories used by /tools.</div>
                    </div>
                    <button
                      type="button"
                      onClick={openNewCategory}
                      className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                      disabled={busy}
                      New
                    </button>
                  </div>

                  <div className="mt-3">
                    {loading ? (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">Loading…</div>
                    ) : categories.length === 0 ? (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
                        No categories yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {categoryOptions.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2"
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-neutral-900">{c.name}</div>
                              <div className="truncate font-mono text-[11px] text-neutral-500">{c.slug}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditCategory(c)}
                                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                                disabled={busy}
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteCategory(c)}
                                className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100"
                                disabled={busy}
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 text-xs text-neutral-500">
                    Deleting a category will move its prompts to <span className="font-semibold">Uncategorized</span>.
                  </div>
                </div>
              </div>

              {/* Prompts */}
              <div className="lg:col-span-8">
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h1 className="text-lg font-semibold">Prompt Library</h1>
                      <p className="mt-1 text-sm text-neutral-600">Create, edit, and delete prompts shown in the gated /tools library.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void loadAll()}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                        disabled={busy}
                        Refresh
                      </button>
                      <button
                        type="button"
                        onClick={openNewPrompt}
                        className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                        disabled={busy}
                        New prompt
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-6">
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search title, description, content…"
                        className="w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        <option value="ALL">All statuses</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="PUBLISHED">PUBLISHED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </div>

                    <div className="lg:col-span-3">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        <option value="ALL">All categories</option>
                        <option value="NONE">Uncategorized</option>
                        {categoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-neutral-500">
                    {loading ? "Loading…" : `${filteredPrompts.length} prompt${filteredPrompts.length === 1 ? "" : "s"}`}
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 text-neutral-600">
                        <tr className="text-left">
                          <th className="px-4 py-3 font-medium">Title</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Updated</th>
                          <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {loading ? (
                          <tr>
                            <td className="px-4 py-6 text-neutral-500" colSpan={5}>
                              Loading…
                            </td>
                          </tr>
                        ) : filteredPrompts.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-neutral-500" colSpan={5}>
                              No prompts found.
                            </td>
                          </tr>
                        ) : (
                          filteredPrompts.map((p) => (
                            <tr key={p.id} className="hover:bg-neutral-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-neutral-900">{p.title}</div>
                                {p.description ? <div className="mt-0.5 text-xs text-neutral-500">{p.description}</div> : null}
                              </td>
                              <td className="px-4 py-3 text-neutral-700">{p.category?.name || "Uncategorized"}</td>
                              <td className="px-4 py-3">
                                <StatusPill status={p.status} />
                              </td>
                              <td className="px-4 py-3 text-neutral-700">{fmtDate(p.updatedAt)}</td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditPrompt(p)}
                                    className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                                    disabled={busy}
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deletePrompt(p)}
                                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                                    disabled={busy}
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
                    Tip: /tools shows only <span className="font-semibold">PUBLISHED</span> prompts.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Prompt modal */}
      <Modal
        open={promptModalOpen}
        title={editing ? "Edit prompt" : "New prompt"}
        onClose={() => {
          if (busy) return;
          setPromptModalOpen(false);
          setEditing(null);
        }}
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
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="text-xs font-semibold text-neutral-700">Category</div>
              <select
                value={promptCategoryId}
                onChange={(e) => setPromptCategoryId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                <option value="">Uncategorized</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-neutral-500">Create categories on the left panel.</div>
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-neutral-700">Description (optional)</div>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                placeholder="One-liner shown in the list"
              />
            </label>
          </div>

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
                setPromptModalOpen(false);
                setEditing(null);
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              disabled={busy}
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void savePrompt()}
              className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              disabled={busy}
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Category modal */}
      <SmallModal
        open={catModalOpen}
        title={catEditing ? "Edit category" : "New category"}
        onClose={() => {
          if (busy) return;
          setCatModalOpen(false);
          setCatEditing(null);
        }}
        <div className="space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-neutral-700">Name</div>
            <input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              placeholder="e.g., Marketing"
            />
            <div className="mt-1 text-[11px] text-neutral-500">Slug is generated automatically.</div>
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCatModalOpen(false);
                setCatEditing(null);
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              disabled={busy}
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveCategory()}
              className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              disabled={busy}
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SmallModal>
    </div>
  );
}