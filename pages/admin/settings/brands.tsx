import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useEffect, useMemo, useState } from "react";
import { requireBackofficePage } from "../../../lib/backofficeAuth";
import AdminLayout from "../../../components/admin/AdminLayout";
import LibraryCardHeader from "../../../components/admin/LibraryCardHeader";
import { useToast } from "../../../components/ui/toast";

type BrandStatus = "SETUP_PENDING" | "ACTIVE" | "DISABLED";

type BrandRecord = {
  id: string;
  brandKey: string;
  name: string;
  status: BrandStatus;
  apexHost: string;
  productionPublicHost: string;
  productionAdminHost: string;
  previewPublicHost: string;
  previewAdminHost: string;
  createdAt: string;
  updatedAt: string;
};

type BrandForm = {
  brandKey: string;
  name: string;
  status: BrandStatus;
  apexHost: string;
  productionPublicHost: string;
  productionAdminHost: string;
  previewPublicHost: string;
  previewAdminHost: string;
};

type BrandsPageProps = {
  loggedInAs: string | null;
};

const NEW_BRAND_ID = "__new__";

function blankBrand(): BrandForm {
  return {
    brandKey: "",
    name: "",
    status: "SETUP_PENDING",
    apexHost: "",
    productionPublicHost: "",
    productionAdminHost: "",
    previewPublicHost: "",
    previewAdminHost: "",
  };
}

function cloneBrand(brand: BrandRecord): BrandForm {
  return {
    brandKey: brand.brandKey,
    name: brand.name,
    status: brand.status,
    apexHost: brand.apexHost,
    productionPublicHost: brand.productionPublicHost,
    productionAdminHost: brand.productionAdminHost,
    previewPublicHost: brand.previewPublicHost,
    previewAdminHost: brand.previewAdminHost,
  };
}

function normalizeBrandForm(form: BrandForm) {
  return JSON.stringify({
    brandKey: form.brandKey.trim().toLowerCase(),
    name: form.name.trim(),
    status: form.status,
    apexHost: form.apexHost.trim().toLowerCase(),
    productionPublicHost: form.productionPublicHost.trim().toLowerCase(),
    productionAdminHost: form.productionAdminHost.trim().toLowerCase(),
    previewPublicHost: form.previewPublicHost.trim().toLowerCase(),
    previewAdminHost: form.previewAdminHost.trim().toLowerCase(),
  });
}

export const getServerSideProps: GetServerSideProps<BrandsPageProps> = async (ctx) => {
  const auth = await requireBackofficePage(ctx, {
    callbackUrl: "/admin/settings/brands",
    superadminOnly: true,
  });
  if (!auth.ok) return auth.response;

  return {
    props: {
      loggedInAs: auth.loggedInAs,
    },
  };
};

function StatusPill({ status }: { status: BrandStatus }) {
  const cls =
    status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "DISABLED"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

export default function BrandsPage({ loggedInAs }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { toast } = useToast();

  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandForm | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string>("");

  async function loadBrands() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/brands");
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || "Failed to load brands");

      const rows = Array.isArray(payload?.brands) ? (payload.brands as BrandRecord[]) : [];
      setBrands(rows);

      if (rows.length === 0) {
        setSelectedId(null);
        setForm(blankBrand());
        return;
      }

      const currentId = selectedId && selectedId !== NEW_BRAND_ID ? selectedId : rows[0].id;
      const selected = rows.find((row) => row.id === currentId) || rows[0];
      setSelectedId(selected.id);
      setForm(cloneBrand(selected));
    } catch (error: any) {
      const message = error?.message || "Failed to load brands";
      setErr(message);
      toast("error", message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredBrands = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((brand) =>
      [
        brand.brandKey,
        brand.name,
        brand.apexHost,
        brand.productionPublicHost,
        brand.productionAdminHost,
        brand.previewPublicHost,
        brand.previewAdminHost,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [brands, search]);

  const selectedBrand = selectedId && selectedId !== NEW_BRAND_ID ? brands.find((brand) => brand.id === selectedId) || null : null;
  const isNewBrand = selectedId === NEW_BRAND_ID;
  const isDirty = useMemo(() => {
    if (!form) return false;
    if (isNewBrand) return normalizeBrandForm(form) !== normalizeBrandForm(blankBrand());
    if (!selectedBrand) return false;
    return normalizeBrandForm(form) !== normalizeBrandForm(cloneBrand(selectedBrand));
  }, [form, isNewBrand, selectedBrand]);

  function selectBrand(brand: BrandRecord) {
    setSelectedId(brand.id);
    setForm(cloneBrand(brand));
    setErr("");
  }

  function startNewBrand() {
    setSelectedId(NEW_BRAND_ID);
    setForm(blankBrand());
    setErr("");
  }

  function updateField<K extends keyof BrandForm>(key: K, value: BrandForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveBrand() {
    if (!form) return;

    setSaving(true);
    setErr("");

    try {
      const method = isNewBrand ? "POST" : "PATCH";
      const url = isNewBrand ? "/api/admin/brands" : `/api/admin/brands/${selectedBrand?.id}`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || "Failed to save brand");

      const saved = payload.brand as BrandRecord;
      const nextBrands = isNewBrand
        ? [...brands, saved]
        : brands.map((brand) => (brand.id === saved.id ? saved : brand));

      setBrands(nextBrands);
      setSelectedId(saved.id);
      setForm(cloneBrand(saved));
      toast("success", isNewBrand ? "Brand created." : "Brand updated.");
    } catch (error: any) {
      const message = error?.message || "Failed to save brand";
      setErr(message);
      toast("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBrand() {
    if (!selectedBrand) return;
    if (!window.confirm(`Delete brand "${selectedBrand.name}"? This will detach brand-linked content and leads.`)) return;

    setDeleting(true);
    setErr("");

    try {
      const res = await fetch(`/api/admin/brands/${selectedBrand.id}`, {
        method: "DELETE",
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || "Failed to delete brand");

      const nextBrands = brands.filter((brand) => brand.id !== selectedBrand.id);
      setBrands(nextBrands);

      if (nextBrands.length > 0) {
        setSelectedId(nextBrands[0].id);
        setForm(cloneBrand(nextBrands[0]));
      } else {
        setSelectedId(null);
        setForm(blankBrand());
      }

      toast("success", "Brand deleted.");
    } catch (error: any) {
      const message = error?.message || "Failed to delete brand";
      setErr(message);
      toast("error", message);
    } finally {
      setDeleting(false);
    }
  }

  const topActions = (
    <>
      <button
        onClick={loadBrands}
        disabled={loading}
        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
      >
        {loading ? "Refreshing…" : "Refresh"}
      </button>
      <button
        onClick={startNewBrand}
        className="rounded-full border border-neutral-200 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
      >
        Add Brand
      </button>
      <button
        onClick={deleteBrand}
        disabled={!selectedBrand || deleting}
        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete Brand"}
      </button>
    </>
  );

  return (
    <AdminLayout title="X Dragon Command — Brands" sectionLabel="Settings / Brands" loggedInAs={loggedInAs} active="settings">
      <div className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <LibraryCardHeader
            title="Brands"
            description="Live brand identity and host-routing configuration. Changes here become the runtime source of truth once saved."
            actionsTop={topActions}
          />

          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            Brand routing is now driven from the database. The current env values are only a fallback when no Brand records exist yet.
          </div>

          <div className="mt-5">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search brands and hosts…"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>

          {err ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
          ) : null}
        </div>

        {brands.length === 0 && !loading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No brands are stored in the database yet. Public runtime can still fall back to env host config, but
            brand-scoped writes should use the explicit brand sync flow before this becomes the long-term source of
            truth.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Brand List</h2>
              <div className="text-xs text-neutral-500">{filteredBrands.length} shown</div>
            </div>

            <div className="space-y-2">
              {filteredBrands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => selectBrand(brand)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                    selectedId === brand.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{brand.name}</div>
                      <div className={`mt-1 text-xs ${selectedId === brand.id ? "text-neutral-300" : "text-neutral-500"}`}>
                        {brand.brandKey}
                      </div>
                    </div>
                    <StatusPill status={brand.status} />
                  </div>
                  <div className={`mt-3 text-xs ${selectedId === brand.id ? "text-neutral-300" : "text-neutral-600"}`}>
                    {brand.productionPublicHost}
                  </div>
                </button>
              ))}

              {filteredBrands.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-600">
                  No brands matched the current search.
                </div>
              ) : null}
            </div>
          </section>

          <section className="lg:col-span-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{isNewBrand ? "New Brand" : form?.name || "Brand Details"}</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Edit the live brand identity and host pairings used by runtime routing.
                </p>
              </div>
              {form ? <StatusPill status={form.status} /> : null}
            </div>

            {!form ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-600">
                Select a brand to edit it.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Brand Key</label>
                    <input
                      value={form.brandKey}
                      onChange={(event) => updateField("brandKey", event.target.value)}
                      placeholder="xdragon"
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Brand Name</label>
                    <input
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      placeholder="X Dragon"
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Status</label>
                    <select
                      value={form.status}
                      onChange={(event) => updateField("status", event.target.value as BrandStatus)}
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
                    >
                      <option value="SETUP_PENDING">SETUP_PENDING</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Apex Host</label>
                    <input
                      value={form.apexHost}
                      onChange={(event) => updateField("apexHost", event.target.value)}
                      placeholder="xdragon.tech"
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-900">Production Hosts</div>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700">Public Host</label>
                        <input
                          value={form.productionPublicHost}
                          onChange={(event) => updateField("productionPublicHost", event.target.value)}
                          placeholder="www.xdragon.tech"
                          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700">Admin Host</label>
                        <input
                          value={form.productionAdminHost}
                          onChange={(event) => updateField("productionAdminHost", event.target.value)}
                          placeholder="admin.xdragon.tech"
                          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-900">Preview Hosts</div>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700">Public Host</label>
                        <input
                          value={form.previewPublicHost}
                          onChange={(event) => updateField("previewPublicHost", event.target.value)}
                          placeholder="staging.xdragon.tech"
                          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700">Admin Host</label>
                        <input
                          value={form.previewAdminHost}
                          onChange={(event) => updateField("previewAdminHost", event.target.value)}
                          placeholder="stg-admin.xdragon.tech"
                          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  <div className="font-semibold text-neutral-900">Runtime Relationship</div>
                  <div className="mt-2">Apex Host routes into the production public experience for this brand.</div>
                  <div className="mt-1">Each environment must provide one public host and one admin host.</div>
                  <div className="mt-1">These values are now used by live request host resolution once the brand is saved.</div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={saveBrand}
                    disabled={saving || !isDirty}
                    className="rounded-full border border-neutral-200 bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : isNewBrand ? "Create Brand" : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      if (selectedBrand) {
                        setForm(cloneBrand(selectedBrand));
                        setErr("");
                      } else {
                        setForm(blankBrand());
                        setErr("");
                      }
                    }}
                    disabled={!isDirty}
                    className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>

                {!isNewBrand && selectedBrand ? (
                  <div className="mt-4 text-xs text-neutral-500">
                    Created {new Date(selectedBrand.createdAt).toLocaleString()} • Updated{" "}
                    {new Date(selectedBrand.updatedAt).toLocaleString()}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
