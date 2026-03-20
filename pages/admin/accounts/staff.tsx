import { BackofficeRole, BackofficeUserStatus, BrandStatus } from "@prisma/client";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import LibraryCardHeader from "../../../components/admin/LibraryCardHeader";
import { useToast } from "../../../components/ui/toast";
import { requireBackofficePage } from "../../../lib/backofficeAuth";
import { fmtDate } from "../../../components/admin/AccountsDirectoryPage";

type StaffAccountRecord = {
  id: string;
  username: string;
  email: string | null;
  role: BackofficeRole;
  status: BackofficeUserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  brandAccessCount: number;
  brandIds: string[];
  brandKeys: string[];
  brandNames: string[];
  protected: boolean;
};

type BrandOption = {
  id: string;
  brandKey: string;
  name: string;
  status: BrandStatus;
};

type StaffForm = {
  username: string;
  email: string;
  role: BackofficeRole;
  password: string;
  confirmPassword: string;
  brandIds: string[];
};

type StaffAccountsPageProps = {
  loggedInAs: string | null;
};

type GeneratedStaffLink = {
  kind: "invite" | "reset";
  url: string;
  expiresAt: string;
  userId: string;
  username: string;
  email: string | null;
};

const NEW_STAFF_ID = "__new__";

function blankStaffForm(): StaffForm {
  return {
    username: "",
    email: "",
    role: BackofficeRole.STAFF,
    password: "",
    confirmPassword: "",
    brandIds: [],
  };
}

function cloneStaffForm(user: StaffAccountRecord): StaffForm {
  return {
    username: user.username,
    email: user.email || "",
    role: user.role,
    password: "",
    confirmPassword: "",
    brandIds: [...user.brandIds],
  };
}

function normalizeStaffForm(form: StaffForm) {
  return JSON.stringify({
    username: form.username.trim().toLowerCase(),
    email: form.email.trim().toLowerCase(),
    role: form.role,
    brandIds: [...form.brandIds].sort(),
  });
}

function StatusPill({ status }: { status: BackofficeUserStatus }) {
  const cls =
    status === BackofficeUserStatus.ACTIVE
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-red-200 bg-red-50 text-red-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

function RolePill({ role }: { role: BackofficeRole }) {
  const cls =
    role === BackofficeRole.SUPERADMIN
      ? "border-neutral-300 bg-neutral-100 text-neutral-800"
      : "border-sky-200 bg-sky-50 text-sky-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{role}</span>;
}

export const getServerSideProps: GetServerSideProps<StaffAccountsPageProps> = async (ctx) => {
  const auth = await requireBackofficePage(ctx, {
    callbackUrl: "/admin/accounts/staff",
    superadminOnly: true,
  });
  if (!auth.ok) return auth.response;

  return {
    props: {
      loggedInAs: auth.loggedInAs,
    },
  };
};

export default function StaffAccountsPage({
  loggedInAs,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { toast } = useToast();

  const [users, setUsers] = useState<StaffAccountRecord[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffForm | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<"block" | "unblock" | "delete" | null>(null);
  const [linkBusy, setLinkBusy] = useState<"invite" | "reset" | null>(null);
  const [generatedLink, setGeneratedLink] = useState<GeneratedStaffLink | null>(null);
  const [err, setErr] = useState("");

  async function loadData(nextSelectedId?: string | null) {
    setLoading(true);
    setErr("");

    try {
      const [usersRes, brandsRes] = await Promise.all([fetch("/api/admin/users"), fetch("/api/admin/brands")]);
      const [usersPayload, brandsPayload] = await Promise.all([
        usersRes.json().catch(() => null),
        brandsRes.json().catch(() => null),
      ]);

      if (!usersRes.ok || !usersPayload?.ok) {
        throw new Error(usersPayload?.error || "Failed to load staff accounts");
      }

      if (!brandsRes.ok || !brandsPayload?.ok) {
        throw new Error(brandsPayload?.error || "Failed to load brands");
      }

      const nextUsers = Array.isArray(usersPayload.users) ? (usersPayload.users as StaffAccountRecord[]) : [];
      const nextBrands = Array.isArray(brandsPayload.brands)
        ? (brandsPayload.brands as Array<{ id: string; brandKey: string; name: string; status: BrandStatus }>)
        : [];

      setUsers(nextUsers);
      setBrands(nextBrands);

      if (nextUsers.length === 0) {
        setSelectedId(NEW_STAFF_ID);
        setForm(blankStaffForm());
        setGeneratedLink(null);
        return;
      }

      const desiredId = nextSelectedId || selectedId;
      if (desiredId === NEW_STAFF_ID) {
        setSelectedId(NEW_STAFF_ID);
        setForm(blankStaffForm());
        setGeneratedLink(null);
        return;
      }

      const selected =
        (desiredId && nextUsers.find((user) => user.id === desiredId)) || nextUsers[0];

      setSelectedId(selected.id);
      setForm(cloneStaffForm(selected));
      setGeneratedLink((current) => (current && current.userId === selected.id ? current : null));
    } catch (error: any) {
      const message = error?.message || "Failed to load staff accounts";
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
        user.username,
        user.email || "",
        user.role,
        user.status,
        user.brandKeys.join(" "),
        user.brandNames.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [search, users]);

  const selectedUser =
    selectedId && selectedId !== NEW_STAFF_ID ? users.find((user) => user.id === selectedId) || null : null;
  const isNewStaff = selectedId === NEW_STAFF_ID;
  const isDirty = useMemo(() => {
    if (!form) return false;
    if (isNewStaff) return normalizeStaffForm(form) !== normalizeStaffForm(blankStaffForm()) || Boolean(form.password);
    if (!selectedUser) return false;
    return normalizeStaffForm(form) !== normalizeStaffForm(cloneStaffForm(selectedUser)) || Boolean(form.password);
  }, [form, isNewStaff, selectedUser]);

  const selectableBrands = useMemo(
    () => brands.filter((brand) => brand.status !== BrandStatus.DISABLED),
    [brands]
  );

  function startNewStaff() {
    setSelectedId(NEW_STAFF_ID);
    setForm(blankStaffForm());
    setGeneratedLink(null);
    setErr("");
  }

  function selectUser(user: StaffAccountRecord) {
    setSelectedId(user.id);
    setForm(cloneStaffForm(user));
    setGeneratedLink((current) => (current && current.userId === user.id ? current : null));
    setErr("");
  }

  function updateField<K extends keyof StaffForm>(key: K, value: StaffForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function toggleBrand(brandId: string) {
    setForm((current) => {
      if (!current) return current;
      const exists = current.brandIds.includes(brandId);
      return {
        ...current,
        brandIds: exists
          ? current.brandIds.filter((value) => value !== brandId)
          : [...current.brandIds, brandId],
      };
    });
  }

  async function saveStaff() {
    if (!form) return;

    if (!form.username.trim()) {
      const message = "Username is required";
      setErr(message);
      toast("error", message);
      return;
    }

    if (isNewStaff && !form.password) {
      const message = "Password is required for new staff accounts";
      setErr(message);
      toast("error", message);
      return;
    }

    if (form.password && form.password.length < 10) {
      const message = "Password must be at least 10 characters";
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

    if (form.role === BackofficeRole.STAFF && form.brandIds.length === 0) {
      const message = "Staff accounts must be assigned to at least one brand";
      setErr(message);
      toast("error", message);
      return;
    }

    setSaving(true);
    setErr("");

    try {
      const url = isNewStaff ? "/api/admin/users" : `/api/admin/users/${selectedUser?.id}`;
      const method = isNewStaff ? "POST" : "PATCH";
      const payload = {
        username: form.username,
        email: form.email,
        role: form.role,
        password: form.password || undefined,
        brandIds: form.role === BackofficeRole.STAFF ? form.brandIds : [],
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Failed to save staff account");

      const savedId = body?.user?.id || selectedUser?.id || null;
      toast("success", isNewStaff ? "Staff account created." : "Staff account updated.");
      await loadData(savedId);
    } catch (error: any) {
      const message = error?.message || "Failed to save staff account";
      setErr(message);
      toast("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: "block" | "unblock" | "delete") {
    if (!selectedUser) return;

    if (action === "delete") {
      const ok = window.confirm(`Delete staff account "${selectedUser.username}"? This cannot be undone.`);
      if (!ok) return;
    }

    setBusyAction(action);
    setErr("");

    try {
      const res =
        action === "delete"
          ? await fetch(`/api/admin/users/${selectedUser.id}`, { method: "DELETE" })
          : await fetch(`/api/admin/users/${selectedUser.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Request failed");

      toast("success", action === "delete" ? "Staff account deleted." : "Staff account updated.");
      await loadData(action === "delete" ? null : selectedUser.id);
    } catch (error: any) {
      const message = error?.message || "Request failed";
      setErr(message);
      toast("error", message);
    } finally {
      setBusyAction(null);
    }
  }

  async function copyGeneratedLink() {
    if (!generatedLink?.url) return;

    try {
      await navigator.clipboard.writeText(generatedLink.url);
      toast("success", "Link copied to clipboard.");
    } catch {
      toast("error", "Failed to copy link.");
    }
  }

  async function createInvite() {
    if (!form || !isNewStaff) return;

    if (!form.username.trim()) {
      const message = "Username is required";
      setErr(message);
      toast("error", message);
      return;
    }

    if (form.password || form.confirmPassword) {
      const message = "Clear the manual password fields when creating an invite-based account";
      setErr(message);
      toast("error", message);
      return;
    }

    if (form.role === BackofficeRole.STAFF && form.brandIds.length === 0) {
      const message = "Staff accounts must be assigned to at least one brand";
      setErr(message);
      toast("error", message);
      return;
    }

    setLinkBusy("invite");
    setErr("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createInvite",
          username: form.username,
          email: form.email,
          role: form.role,
          brandIds: form.role === BackofficeRole.STAFF ? form.brandIds : [],
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Failed to create invite");

      const savedId = body?.user?.id || null;
      const invite = body?.invite || null;
      toast("success", "Invite link created.");
      await loadData(savedId);
      setGeneratedLink(invite);
    } catch (error: any) {
      const message = error?.message || "Failed to create invite";
      setErr(message);
      toast("error", message);
    } finally {
      setLinkBusy(null);
    }
  }

  async function generateResetLink() {
    if (!selectedUser) return;

    setLinkBusy("reset");
    setErr("");

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generateResetLink" }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Failed to generate reset link");

      setGeneratedLink(body?.invite || null);
      toast("success", "Reset link created.");
    } catch (error: any) {
      const message = error?.message || "Failed to generate reset link";
      setErr(message);
      toast("error", message);
    } finally {
      setLinkBusy(null);
    }
  }

  return (
    <AdminLayout title="Admin • Staff Accounts" sectionLabel="Accounts" loggedInAs={loggedInAs} active="accounts">
      <section className="space-y-6">
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <LibraryCardHeader
              title="Staff Accounts"
              description="Create and manage staff and superadmin accounts for the shared backoffice."
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
                    onClick={startNewStaff}
                    className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    Add Staff
                  </button>
                </>
              }
            />

            <div className="mt-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search username, email, role, brand, status…"
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
                  No staff accounts found.
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
                          <div className="font-semibold">{user.username}</div>
                          <div className={`mt-1 text-sm ${selected ? "text-neutral-300" : "text-neutral-600"}`}>
                            {user.email || "No email set"}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <RolePill role={user.role} />
                          <StatusPill status={user.status} />
                        </div>
                      </div>

                      <div className={`mt-3 text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                        {user.role === BackofficeRole.SUPERADMIN
                          ? "All brands"
                          : user.brandKeys.length > 0
                            ? user.brandKeys.join(", ")
                            : "No brands assigned"}
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
                title={isNewStaff ? "New Staff Account" : selectedUser ? selectedUser.username : "Staff Account"}
                description={
                  isNewStaff
                    ? "Create a new backoffice account with explicit role and brand access."
                    : "Edit the selected staff account. Password changes are optional."
                }
                actionsTop={
                  <>
                    {!isNewStaff && selectedUser ? (
                      <button
                        type="button"
                        onClick={() => void generateResetLink()}
                        className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                        disabled={Boolean(linkBusy)}
                      >
                        {linkBusy === "reset" ? "Generating…" : "Generate Reset Link"}
                      </button>
                    ) : null}
                    {isNewStaff ? (
                      <button
                        type="button"
                        onClick={() => void createInvite()}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                        disabled={!form || saving || linkBusy === "invite"}
                      >
                        {linkBusy === "invite" ? "Generating…" : "Create & Invite"}
                      </button>
                    ) : null}
                    {!isNewStaff && selectedUser ? (
                      <button
                        type="button"
                        onClick={() => void runAction(selectedUser.status === BackofficeUserStatus.ACTIVE ? "block" : "unblock")}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                          selectedUser.status === BackofficeUserStatus.ACTIVE
                            ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        }`}
                        disabled={Boolean(busyAction)}
                      >
                        {selectedUser.status === BackofficeUserStatus.ACTIVE ? "Block" : "Unblock"}
                      </button>
                    ) : null}
                    {!isNewStaff && selectedUser ? (
                      <button
                        type="button"
                        onClick={() => void runAction("delete")}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
                        disabled={Boolean(busyAction)}
                      >
                        Delete
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void saveStaff()}
                      className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                      disabled={!form || saving || linkBusy === "invite" || !isDirty}
                    >
                      {saving ? "Saving…" : isNewStaff ? "Create Staff" : "Save Changes"}
                    </button>
                  </>
                }
              />

              {!form ? (
                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                  Select a staff account to manage.
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {selectedUser?.protected ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      This is a protected admin account. Role, block, delete, and email changes are restricted.
                    </div>
                  ) : null}

                  {generatedLink ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-sky-900">
                            {generatedLink.kind === "invite" ? "Invite Link Ready" : "Reset Link Ready"}
                          </div>
                          <div className="mt-1 text-sm text-sky-800">
                            Share this one-time link with <span className="font-medium">{generatedLink.username}</span>.
                            {generatedLink.email ? ` Account email: ${generatedLink.email}.` : " No email is set on this account."}
                          </div>
                          <div className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-3 text-xs text-sky-900 break-all">
                            {generatedLink.url}
                          </div>
                          <div className="mt-2 text-xs text-sky-700">Expires {fmtDate(generatedLink.expiresAt)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyGeneratedLink()}
                          className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
                        >
                          Copy Link
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">Username</div>
                      <input
                        value={form.username}
                        onChange={(event) => updateField("username", event.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        placeholder="grant"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">Email</div>
                      <input
                        value={form.email}
                        onChange={(event) => updateField("email", event.target.value)}
                        disabled={Boolean(selectedUser?.protected)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100"
                        placeholder="grant@xdragon.tech"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">Role</div>
                      <select
                        value={form.role}
                        onChange={(event) => updateField("role", event.target.value as BackofficeRole)}
                        disabled={Boolean(selectedUser?.protected)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100"
                      >
                        <option value={BackofficeRole.STAFF}>STAFF</option>
                        <option value={BackofficeRole.SUPERADMIN}>SUPERADMIN</option>
                      </select>
                    </label>

                    <div className="flex items-end">
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                        {form.role === BackofficeRole.SUPERADMIN
                          ? "Superadmins can access all brands and global settings."
                          : "Staff must have at least one brand assignment to sign in."}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">
                        {isNewStaff ? "Password" : "New Password"}
                      </div>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(event) => updateField("password", event.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        placeholder={isNewStaff ? "Minimum 10 characters" : "Leave blank to keep current password"}
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-neutral-700">Confirm Password</div>
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(event) => updateField("confirmPassword", event.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        placeholder="Repeat password"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-neutral-900">Brand Access</h2>
                        <p className="mt-1 text-sm text-neutral-600">
                          Assign the brands this staff user can access in the shared backoffice.
                        </p>
                      </div>
                      {selectedUser ? <StatusPill status={selectedUser.status} /> : null}
                    </div>

                    {form.role === BackofficeRole.SUPERADMIN ? (
                      <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
                        Superadmins inherit access to every configured brand. No per-brand assignment is required.
                      </div>
                    ) : selectableBrands.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        No active brands are available yet. Configure brands before creating staff accounts.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {selectableBrands.map((brand) => {
                          const checked = form.brandIds.includes(brand.id);
                          return (
                            <label
                              key={brand.id}
                              className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleBrand(brand.id)}
                                className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                              />
                              <span>
                                <span className="block font-medium text-neutral-900">{brand.name}</span>
                                <span className="mt-0.5 block text-xs text-neutral-500">{brand.brandKey}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
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
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}
