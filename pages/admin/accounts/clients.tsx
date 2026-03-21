import { BackofficeRole, BrandStatus, ExternalUserStatus } from "@prisma/client";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import { fmtDate } from "../../../components/admin/AccountsDirectoryPage";
import LibraryCardHeader from "../../../components/admin/LibraryCardHeader";
import { useToast } from "../../../components/ui/toast";
import { requireBackofficePage } from "../../../lib/backofficeAuth";

type ClientAccountRecord = {
  id: string;
  name: string | null;
  email: string;
  brandId: string;
  brandKey: string;
  brandName: string;
  brandStatus: BrandStatus;
  status: ExternalUserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  legacyLinked: boolean;
  providerCount: number;
  providerLabels: string[];
  loginEventCount: number;
  canReassignBrand: boolean;
  brandLockReason: string | null;
};

type BrandOption = {
  id: string;
  brandKey: string;
  name: string;
  status: BrandStatus;
};

type ClientForm = {
  name: string;
  email: string;
  brandId: string;
  password: string;
  confirmPassword: string;
  markEmailVerified: boolean;
};

type ClientAccountsPageProps = {
  loggedInAs: string | null;
  canManageClients: boolean;
};

const NEW_CLIENT_ID = "__new__";

function blankClientForm(brands: BrandOption[]): ClientForm {
  return {
    name: "",
    email: "",
    brandId: brands[0]?.id || "",
    password: "",
    confirmPassword: "",
    markEmailVerified: true,
  };
}

function cloneClientForm(user: ClientAccountRecord): ClientForm {
  return {
    name: user.name || "",
    email: user.email,
    brandId: user.brandId,
    password: "",
    confirmPassword: "",
    markEmailVerified: Boolean(user.emailVerifiedAt),
  };
}

function normalizeClientForm(form: ClientForm) {
  return JSON.stringify({
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    brandId: form.brandId,
  });
}

function StatusPill({ status }: { status: ExternalUserStatus }) {
  const cls =
    status === ExternalUserStatus.ACTIVE
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-red-200 bg-red-50 text-red-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

function VerificationPill({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      Verified
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      Unverified
    </span>
  );
}

export const getServerSideProps: GetServerSideProps<ClientAccountsPageProps> = async (ctx) => {
  const auth = await requireBackofficePage(ctx, {
    callbackUrl: "/admin/accounts/clients",
  });
  if (!auth.ok) return auth.response;

  return {
    props: {
      loggedInAs: auth.loggedInAs,
      canManageClients: auth.principal.role === BackofficeRole.SUPERADMIN,
    },
  };
};

export default function ClientAccountsPage({
  loggedInAs,
  canManageClients,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { toast } = useToast();

  const [users, setUsers] = useState<ClientAccountRecord[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<"verify" | "block" | "unblock" | "delete" | null>(null);
  const [err, setErr] = useState("");

  async function loadData(nextSelectedId?: string | null) {
    setLoading(true);
    setErr("");

    try {
      const [usersRes, brandsRes] = await Promise.all([fetch("/api/admin/client-accounts"), fetch("/api/admin/brands")]);
      const [usersPayload, brandsPayload] = await Promise.all([
        usersRes.json().catch(() => null),
        brandsRes.json().catch(() => null),
      ]);

      if (!usersRes.ok || !usersPayload?.ok) {
        throw new Error(usersPayload?.error || "Failed to load client accounts");
      }

      if (!brandsRes.ok || !brandsPayload?.ok) {
        throw new Error(brandsPayload?.error || "Failed to load brands");
      }

      const nextUsers = Array.isArray(usersPayload.users) ? (usersPayload.users as ClientAccountRecord[]) : [];
      const nextBrands = Array.isArray(brandsPayload.brands)
        ? (brandsPayload.brands as Array<{ id: string; brandKey: string; name: string; status: BrandStatus }>)
        : [];

      setUsers(nextUsers);
      setBrands(nextBrands);

      if (nextUsers.length === 0) {
        setSelectedId(canManageClients ? NEW_CLIENT_ID : null);
        setForm(canManageClients ? blankClientForm(nextBrands) : null);
        return;
      }

      const desiredId = nextSelectedId || selectedId;
      if (desiredId === NEW_CLIENT_ID) {
        setSelectedId(NEW_CLIENT_ID);
        setForm(blankClientForm(nextBrands));
        return;
      }

      const selected = (desiredId && nextUsers.find((user) => user.id === desiredId)) || nextUsers[0];
      setSelectedId(selected.id);
      setForm(cloneClientForm(selected));
    } catch (error: any) {
      const message = error?.message || "Failed to load client accounts";
      setErr(message);
      toast("error", message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [
        user.name || "",
        user.email,
        user.brandKey,
        user.brandName,
        user.status,
        user.emailVerifiedAt ? "verified" : "unverified",
        user.providerLabels.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [search, users]);

  const selectableBrands = useMemo(
    () => brands.filter((brand) => brand.status !== BrandStatus.DISABLED),
    [brands]
  );

  const selectedUser =
    selectedId && selectedId !== NEW_CLIENT_ID ? users.find((user) => user.id === selectedId) || null : null;
  const isNewClient = selectedId === NEW_CLIENT_ID;
  const isDirty = useMemo(() => {
    if (!form) return false;
    if (isNewClient) {
      return normalizeClientForm(form) !== normalizeClientForm(blankClientForm(selectableBrands)) || Boolean(form.password);
    }
    if (!selectedUser) return false;
    return normalizeClientForm(form) !== normalizeClientForm(cloneClientForm(selectedUser)) || Boolean(form.password);
  }, [form, isNewClient, selectableBrands, selectedUser]);

  function startNewClient() {
    setSelectedId(NEW_CLIENT_ID);
    setForm(blankClientForm(selectableBrands));
    setErr("");
  }

  function selectUser(user: ClientAccountRecord) {
    setSelectedId(user.id);
    setForm(cloneClientForm(user));
    setErr("");
  }

  function updateField<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveClient() {
    if (!form) return;

    if (!form.email.trim()) {
      const message = "Email is required";
      setErr(message);
      toast("error", message);
      return;
    }

    if (!form.brandId) {
      const message = "Brand selection is required";
      setErr(message);
      toast("error", message);
      return;
    }

    if (isNewClient && !form.password) {
      const message = "Password is required for new client accounts";
      setErr(message);
      toast("error", message);
      return;
    }

    if (form.password && form.password.length < 8) {
      const message = "Password must be at least 8 characters";
      setErr(message);
      toast("error", message);
      return;
    }

    if (form.password !== form.confirmPassword) {
      const message = "Password confirmation does not match";
      setErr(message);
      toast("error", message);
      return;
    }

    setSaving(true);
    setErr("");

    try {
      const url = isNewClient ? "/api/admin/client-accounts" : `/api/admin/client-accounts/${selectedUser?.id}`;
      const method = isNewClient ? "POST" : "PATCH";
      const payload = {
        name: form.name,
        email: form.email,
        brandId: form.brandId,
        password: form.password || undefined,
        markEmailVerified: isNewClient ? form.markEmailVerified : undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Failed to save client account");

      const savedId = body?.user?.id || selectedUser?.id || null;
      toast("success", isNewClient ? "Client account created." : "Client account updated.");
      await loadData(savedId);
    } catch (error: any) {
      const message = error?.message || "Failed to save client account";
      setErr(message);
      toast("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: "verify" | "block" | "unblock" | "delete") {
    if (!selectedUser) return;

    if (action === "delete") {
      const ok = window.confirm(`Delete client account "${selectedUser.email}"? This cannot be undone.`);
      if (!ok) return;
    }

    setBusyAction(action);
    setErr("");

    try {
      const res =
        action === "delete"
          ? await fetch(`/api/admin/client-accounts/${selectedUser.id}`, { method: "DELETE" })
          : await fetch(`/api/admin/client-accounts/${selectedUser.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Request failed");

      toast(
        "success",
        action === "delete"
          ? "Client account deleted."
          : action === "verify"
            ? "Client account verified."
            : "Client account updated."
      );
      await loadData(action === "delete" ? null : selectedUser.id);
    } catch (error: any) {
      const message = error?.message || "Request failed";
      setErr(message);
      toast("error", message);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AdminLayout title="Admin • Client Accounts" sectionLabel="Accounts" loggedInAs={loggedInAs} active="accounts">
      <section className="space-y-6">
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <LibraryCardHeader
              title="Client Accounts"
              description="Manage brand-scoped external accounts for the public website."
              actionsTop={
                <>
                  <button
                    type="button"
                    onClick={() => void loadData(selectedId)}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    disabled={loading}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={startNewClient}
                    className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                    disabled={!canManageClients}
                  >
                    Add Client
                  </button>
                </>
              }
            />

            {!canManageClients ? (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                Client accounts are scoped to your assigned brands. Only superadmins can create, edit, verify, block, or delete them right now.
              </div>
            ) : null}

            <div className="mt-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, brand, verification, provider…"
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              />
            </div>

            <div className="mt-3 text-sm text-neutral-500">
              {loading ? "Loading…" : `${filteredUsers.length} account${filteredUsers.length === 1 ? "" : "s"}`}
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                  Loading…
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                  No client accounts found.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const selected = user.id === selectedId;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectUser(user)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        selected
                          ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                          : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{user.name || user.email}</div>
                          <div className={`mt-1 text-sm ${selected ? "text-neutral-300" : "text-neutral-600"}`}>
                            {user.email}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <VerificationPill verified={Boolean(user.emailVerifiedAt)} />
                          <StatusPill status={user.status} />
                        </div>
                      </div>

                      <div className={`mt-3 text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                        {user.brandName} · {user.brandKey}
                        {user.providerCount > 0 ? ` · ${user.providerLabels.join(", ")}` : ""}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <LibraryCardHeader
                title={isNewClient ? "New Client Account" : selectedUser ? selectedUser.email : "Client Account"}
                actionsTop={
                  <>
                    {!isNewClient && selectedUser && !selectedUser.emailVerifiedAt ? (
                      <button
                        type="button"
                        onClick={() => void runAction("verify")}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                        disabled={!canManageClients || Boolean(busyAction)}
                      >
                        Mark Verified
                      </button>
                    ) : null}
                    {!isNewClient && selectedUser ? (
                      <button
                        type="button"
                        onClick={() => void runAction(selectedUser.status === ExternalUserStatus.ACTIVE ? "block" : "unblock")}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                          selectedUser.status === ExternalUserStatus.ACTIVE
                            ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        }`}
                        disabled={!canManageClients || Boolean(busyAction)}
                      >
                        {selectedUser.status === ExternalUserStatus.ACTIVE ? "Block" : "Unblock"}
                      </button>
                    ) : null}
                    {!isNewClient && selectedUser ? (
                      <button
                        type="button"
                        onClick={() => void runAction("delete")}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
                        disabled={!canManageClients || Boolean(busyAction)}
                      >
                        Delete
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void saveClient()}
                      className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                      disabled={!canManageClients || !form || saving || !isDirty}
                    >
                      {saving ? "Saving…" : isNewClient ? "Create Client" : "Save Changes"}
                    </button>
                  </>
                }
              />

              {!form ? (
                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                  Select a client account to manage.
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  <fieldset disabled={!canManageClients} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">Client Name</div>
                      <input
                        value={form.name}
                        onChange={(event) => updateField("name", event.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100"
                        placeholder="Grant Rogers"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">Email</div>
                      <input
                        value={form.email}
                        onChange={(event) => updateField("email", event.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100"
                        placeholder="client@example.com"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">Brand</div>
                      <select
                        value={form.brandId}
                        onChange={(event) => updateField("brandId", event.target.value)}
                        disabled={!canManageClients || Boolean(selectedUser && !selectedUser.canReassignBrand)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100"
                      >
                        <option value="">Select a brand</option>
                        {selectableBrands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name} ({brand.brandKey})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex items-end">
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                        {selectedUser?.brandLockReason
                          ? selectedUser.brandLockReason
                          : "Client accounts are brand-scoped. Use a new account instead of reassigning active history."}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">
                        {isNewClient ? "Password" : "New Password"}
                      </div>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(event) => updateField("password", event.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100"
                        placeholder={isNewClient ? "Minimum 8 characters" : "Leave blank to keep current password"}
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">Confirm Password</div>
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(event) => updateField("confirmPassword", event.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100"
                        placeholder="Repeat password"
                      />
                    </label>
                  </div>

                  {isNewClient ? (
                    <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={form.markEmailVerified}
                        onChange={(event) => updateField("markEmailVerified", event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 disabled:cursor-not-allowed"
                      />
                      <span>
                        <span className="block font-medium text-neutral-900">Mark email as verified on create</span>
                        <span className="mt-1 block text-neutral-600">
                          Leave this on when you are provisioning a client account directly and want it usable immediately.
                        </span>
                      </span>
                    </label>
                  ) : null}

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-neutral-900">Lifecycle Status</h2>
                        <p className="mt-1 text-sm text-neutral-600">
                          Verification, provider linkage, and legacy bridge state are read from the live account.
                        </p>
                      </div>
                      {selectedUser ? <StatusPill status={selectedUser.status} /> : null}
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Verified</div>
                        <div className="mt-2 text-sm text-neutral-800">
                          {selectedUser?.emailVerifiedAt ? fmtDate(selectedUser.emailVerifiedAt) : "No"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Providers</div>
                        <div className="mt-2 text-sm text-neutral-800">
                          {selectedUser ? (selectedUser.providerCount > 0 ? selectedUser.providerLabels.join(", ") : "Password only") : "—"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Legacy Link</div>
                        <div className="mt-2 text-sm text-neutral-800">{selectedUser?.legacyLinked ? "Yes" : "No"}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Login Events</div>
                        <div className="mt-2 text-sm text-neutral-800">{selectedUser ? selectedUser.loginEventCount : "—"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Created</div>
                      <div className="mt-2 text-sm text-neutral-800">{selectedUser ? fmtDate(selectedUser.createdAt) : "—"}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Updated</div>
                      <div className="mt-2 text-sm text-neutral-800">{selectedUser ? fmtDate(selectedUser.updatedAt) : "—"}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Last Login</div>
                      <div className="mt-2 text-sm text-neutral-800">{selectedUser ? fmtDate(selectedUser.lastLoginAt) : "—"}</div>
                    </div>
                  </div>
                  </fieldset>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}
