// pages/admin/library/guides.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { authOptions } from "../../api/auth/[...nextauth]";
import AdminHeader from "../../../components/admin/AdminHeader";
import AdminSidebar from "../../../components/admin/AdminSidebar";

type PromptStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type ArticleCategoryRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number | null;
  createdAt?: string | null;
};

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: PromptStatus;
  tags?: string[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  categoryId?: string | null;
  category?: ArticleCategoryRow | null;
};

type ApiOkArticles = { ok: true; articles: ArticleRow[] };
type ApiOkCats = { ok: true; categories: ArticleCategoryRow[] };
type ApiErr = { ok: false; error: string };

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  const role = (session as any)?.role as string | undefined;
  const status = (session as any)?.status as string | undefined;

  if (!session?.user || role !== "ADMIN" || status === "BLOCKED") {
    const callbackUrl = encodeURIComponent("/admin/library/articles");
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
          >
            Close
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function AdminArticlesPage(_props: InferGetServerSidePropsType<typeof getServerSideProps>) {
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

  const [categories, setCategories] = useState<ArticleCategoryRow[]>([]);
  const [articles, setArticles] = useState<ArticleRow[]>([]);

  // Article modal state
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [editing, setEditing] = useState<ArticleRow | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<PromptStatus>("DRAFT");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [articleCategoryId, setArticleCategoryId] = useState<string>(""); // "" = uncategorized

  // Category modal state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<ArticleCategoryRow | null>(null);
  const [catName, setCatName] = useState("");

  const categoryOptions = useMemo(() => categories.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")), [categories]);

  const filteredArticles = useMemo(() => {
    const s = q.trim().toLowerCase();

    return articles.filter((a) => {
      const inQ =
        !s ||
        a.title.toLowerCase().includes(s) ||
        a.slug.toLowerCase().includes(s) ||
        a.summary.toLowerCase().includes(s) ||
        a.content.toLowerCase().includes(s) ||
        (a.tags || []).join(" ").toLowerCase().includes(s);

      const inStatus = statusFilter === "ALL" || a.status === statusFilter;
      const inCat =
        categoryFilter === "ALL" ||
        (categoryFilter === "NONE" ? !a.categoryId : a.categoryId === categoryFilter);

      return inQ && inStatus && inCat;
    });
  }, [articles, categoryFilter, q, statusFilter]);

  async function fetchJson<T>(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const data = (await res.json()) as T | ApiErr;
    if (!res.ok || (data as any).ok === false) {
      throw new Error((data as any).error || "Request failed");
    }
    return data as T;
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const [cats, arts] = await Promise.all([
        fetchJson<ApiOkCats>("/api/admin/library/guide-categories"),
        fetchJson<ApiOkArticles>(q.trim() ? `/api/admin/library/guides?q=${encodeURIComponent(q.trim())}` : "/api/admin/library/guides"),
      ]);

      setCategories(cats.categories || []);
      setArticles(arts.articles || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNewCategory() {
    setCatEditing(null);
    setCatName("");
    setCatModalOpen(true);
  }

  function openEditCategory(c: ArticleCategoryRow) {
    setCatEditing(c);
    setCatName(c.name);
    setCatModalOpen(true);
  }

  async function saveCategory() {
    const name = catName.trim();
    if (!name) {
      setErr("Category name is required.");
      return;
    }

    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      if (catEditing) {
        await fetchJson(`/api/admin/library/guide-categories/${catEditing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name }),
        });
        setMsg("Category updated.");
      } else {
        await fetchJson(`/api/admin/library/guide-categories`, {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        setMsg("Category created.");
      }
      setCatModalOpen(false);
      setCatEditing(null);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Failed to save category");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(c: ArticleCategoryRow) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fetchJson(`/api/admin/library/guide-categories/${c.id}`, { method: "DELETE" });
      setMsg("Category deleted.");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete category");
    } finally {
      setBusy(false);
    }
  }

  function openNewArticle() {
    setEditing(null);
    setTitle("");
    setSlug("");
    setSummary("");
    setStatus("DRAFT");
    setContent("");
    setTags("");
    setArticleCategoryId("");
    setArticleModalOpen(true);
  }

  function openEditArticle(a: ArticleRow) {
    setEditing(a);
    setTitle(a.title);
    setSlug(a.slug);
    setSummary(a.summary);
    setStatus(a.status);
    setContent(a.content);
    setTags((a.tags || []).join(", "));
    setArticleCategoryId(a.categoryId || "");
    setArticleModalOpen(true);
  }

  async function saveArticle() {
    const t = title.trim();
    const s = slug.trim();
    const sum = summary.trim();
    const c = content.trim();

    if (!t) return setErr("Title is required.");
    if (!s) return setErr("Slug is required.");
    if (!sum) return setErr("Summary is required.");
    if (!c) return setErr("Content is required.");

    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const payload = {
        title: t,
        slug: s,
        summary: sum,
        content: c,
        status,
        categoryId: articleCategoryId ? articleCategoryId : null,
        tags,
      };

      if (editing) {
        await fetchJson(`/api/admin/library/guides/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMsg("Article updated.");
      } else {
        await fetchJson(`/api/admin/library/guides`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMsg("Article created.");
      }

      setArticleModalOpen(false);
      setEditing(null);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Failed to save article");
    } finally {
      setBusy(false);
    }
  }

  async function deleteArticle(a: ArticleRow) {
    if (!confirm(`Delete article "${a.title}"?`)) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fetchJson(`/api/admin/library/guides/${a.id}`, { method: "DELETE" });
      setMsg("Article deleted.");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete article");
    } finally {
      setBusy(false);
    }
  }

  async function setArticleStatus(a: ArticleRow, next: PromptStatus) {
    if (a.status === next) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fetchJson(`/api/admin/library/guides/${a.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      setMsg(`Status set to ${next}.`);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Head>
        <title>Admin • Guides</title>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <AdminHeader sectionLabel="Library" loggedInAs={loggedInAs} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <AdminSidebar active="library" />

<section className="lg:col-span-10">
            {(err || msg) && (
              <div className="mb-4 space-y-2">
                {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}
                {msg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>
                )}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Article Categories */}
              <div className="lg:col-span-4">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">Article Categories</div>
                      <div className="mt-1 text-xs text-neutral-500">Separate categories for articles.</div>
                    </div>
                    <button
                      type="button"
                      onClick={openNewCategory}
                      className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                      disabled={busy}
                    >
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
                          >
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
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteCategory(c)}
                                className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100"
                                disabled={busy}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Articles */}
              <div className="lg:col-span-8">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">Guides</div>
                      <div className="mt-1 text-xs text-neutral-500">Add, edit, delete, and set status.</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openNewArticle}
                        className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                        disabled={busy}
                      >
                        New
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <div className="text-xs font-semibold text-neutral-700">Search</div>
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        placeholder="Title, slug, summary, content, tag…"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="text-xs font-semibold text-neutral-700">Status</div>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        >
                          <option value="ALL">All</option>
                          <option value="DRAFT">DRAFT</option>
                          <option value="PUBLISHED">PUBLISHED</option>
                          <option value="ARCHIVED">ARCHIVED</option>
                        </select>
                      </label>

                      <label className="block">
                        <div className="text-xs font-semibold text-neutral-700">Category</div>
                        <select
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        >
                          <option value="ALL">All</option>
                          <option value="NONE">Uncategorized</option>
                          {categoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4">
                    {loading ? (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">Loading…</div>
                    ) : filteredArticles.length === 0 ? (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">No articles.</div>
                    ) : (
                      <div className="space-y-2">
                        {filteredArticles.map((a) => (
                          <div
                            key={a.id}
                            className="rounded-2xl border border-neutral-200 bg-white p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="truncate text-sm font-semibold text-neutral-900">{a.title}</div>
                                  <StatusPill status={a.status} />
                                </div>
                                <div className="mt-1 truncate font-mono text-[11px] text-neutral-500">{a.slug}</div>
                                <div className="mt-2 line-clamp-2 text-sm text-neutral-700">{a.summary}</div>
                                <div className="mt-2 text-xs text-neutral-500">
                                  {a.category?.name ? <span>{a.category.name} • </span> : null}
                                  Updated {fmtDate(a.updatedAt || null)}
                                  {a.tags?.length ? <span> • Tags: {a.tags.join(", ")}</span> : null}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditArticle(a)}
                                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                                  disabled={busy}
                                >
                                  Edit
                                </button>

                                <select
                                  value={a.status}
                                  onChange={(e) => void setArticleStatus(a, e.target.value as PromptStatus)}
                                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 outline-none"
                                  disabled={busy}
                                >
                                  <option value="DRAFT">DRAFT</option>
                                  <option value="PUBLISHED">PUBLISHED</option>
                                  <option value="ARCHIVED">ARCHIVED</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() => void deleteArticle(a)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100"
                                  disabled={busy}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Article modal */}
      <Modal
        open={articleModalOpen}
        title={editing ? "Edit article" : "New article"}
        onClose={() => {
          if (busy) return;
          setArticleModalOpen(false);
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
                placeholder="e.g., How to reduce checkout friction"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-neutral-700">Slug</div>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                placeholder="e.g., reduce-checkout-friction"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-semibold text-neutral-700">Summary</div>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              placeholder="1–2 sentence summary for search results."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-1">
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

            <label className="block sm:col-span-2">
              <div className="text-xs font-semibold text-neutral-700">Category</div>
              <select
                value={articleCategoryId}
                onChange={(e) => setArticleCategoryId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              >
                <option value="">Uncategorized</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-semibold text-neutral-700">Tags</div>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              placeholder="comma-separated (optional)"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-neutral-700">Content (Markdown)</div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 h-56 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              placeholder="Write the article here…"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setArticleModalOpen(false);
                setEditing(null);
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveArticle()}
              className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              disabled={busy}
            >
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
      >
        <div className="space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-neutral-700">Name</div>
            <input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              placeholder="e.g., Automation"
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
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveCategory()}
              className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SmallModal>
    </div>
  );
}
