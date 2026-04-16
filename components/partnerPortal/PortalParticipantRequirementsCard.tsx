import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CommandPartnerAssetAccess,
  CommandPartnerPortalRequirement,
  CommandPartnerPortalRequirementsPayload,
  CommandParticipantRequirementType,
} from "../../lib/commandPublicApi";

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function requirementStateTone(state: CommandPartnerPortalRequirement["state"]) {
  if (state === "APPROVED") return "bg-green-100 text-green-800";
  if (state === "PENDING_REVIEW") return "bg-amber-100 text-amber-800";
  if (state === "REJECTED" || state === "EXPIRED" || state === "MISSING") return "bg-red-100 text-red-700";
  return "bg-neutral-100 text-neutral-700";
}

type RequirementDraft = {
  file: File | null;
  expiresAt: string;
};

// HUMAN-REVIEW: Wave 12 — document thumbnail and lightbox preview
function DocumentPreview(props: { url: string; mimeType: string; fileName: string; height: string; onClick?: () => void }) {
  const isImage = props.mimeType.startsWith("image/");
  if (isImage) {
    return (
      <img
        src={props.url}
        alt={props.fileName}
        onClick={props.onClick}
        className={`block w-full bg-white ${props.onClick ? "cursor-pointer" : ""}`}
        style={{ height: props.height, objectFit: "contain" }}
      />
    );
  }
  return (
    <iframe
      src={props.url}
      title={props.fileName}
      className="block w-full border-0 bg-white"
      style={{ height: props.height }}
    />
  );
}

function DocumentLightbox(props: {
  access: CommandPartnerAssetAccess;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 md:p-8"
      onClick={props.onClose}
    >
      <div
        className="grid w-full max-w-5xl grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-auto p-5">
          <div className="mb-3 grid gap-1">
            <div className="text-base font-semibold text-neutral-900">
              {humanize(props.access.fileName.split(".")[0]?.toUpperCase() || props.access.fileName)}
            </div>
            <div className="text-sm text-neutral-500">{props.access.fileName}</div>
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
            <DocumentPreview
              url={props.access.url}
              mimeType={props.access.mimeType}
              fileName={props.access.fileName}
              height="70vh"
            />
          </div>
        </div>
        <div className="flex justify-end border-t border-neutral-200 px-5 py-4">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalParticipantRequirementsCard() {
  const [payload, setPayload] = useState<CommandPartnerPortalRequirementsPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RequirementDraft>>({});
  const [loading, setLoading] = useState(true);
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<CommandParticipantRequirementType | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // HUMAN-REVIEW: Wave 12 — asset access cache for thumbnails and lightbox
  const [assetAccessCache, setAssetAccessCache] = useState<Record<string, CommandPartnerAssetAccess>>({});
  const [lightboxAccess, setLightboxAccess] = useState<CommandPartnerAssetAccess | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bff/partners/requirements");
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign("/partners/signin?error=SessionExpired");
        return;
      }
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "Failed to load partner requirements.");
      }
      const nextPayload = body as CommandPartnerPortalRequirementsPayload;
      setPayload(nextPayload);
      setDrafts(
        Object.fromEntries(
          nextPayload.requirements.map((entry) => [
            entry.requirementType,
            {
              file: null,
              expiresAt: entry.expiresAt ? entry.expiresAt.slice(0, 10) : "",
            },
          ])
        )
      );
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to load partner requirements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const outstandingCount = useMemo(() => {
    return payload?.requirements.filter((entry) => entry.state !== "APPROVED").length || 0;
  }, [payload]);

  // HUMAN-REVIEW: Wave 12 — fetch asset access URL for thumbnail and lightbox
  const fetchAssetAccess = useCallback(async (assetId: string): Promise<CommandPartnerAssetAccess | null> => {
    // Return cached if available
    if (assetAccessCache[assetId]) return assetAccessCache[assetId];
    try {
      const response = await fetch(`/api/bff/partners/assets/${assetId}/access`);
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign("/partners/signin?error=SessionExpired");
        return null;
      }
      if (!response.ok || !body?.ok || !body?.access?.url) return null;
      const access = body.access as CommandPartnerAssetAccess;
      setAssetAccessCache((prev) => ({ ...prev, [assetId]: access }));
      return access;
    } catch {
      return null;
    }
  }, [assetAccessCache]);

  // Prefetch asset access for thumbnails when requirements load
  useEffect(() => {
    if (!payload?.requirements) return;
    for (const req of payload.requirements) {
      if (req.asset?.id && !assetAccessCache[req.asset.id]) {
        void fetchAssetAccess(req.asset.id);
      }
    }
  }, [payload?.requirements]);

  async function openAsset(assetId: string) {
    setOpeningAssetId(assetId);
    setError("");
    try {
      const access = await fetchAssetAccess(assetId);
      if (!access) {
        throw new Error("Failed to open requirement document.");
      }
      // HUMAN-REVIEW: Wave 12 — open in lightbox instead of new tab
      setLightboxAccess(access);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to open requirement document.");
      setNotice("");
    } finally {
      setOpeningAssetId(null);
    }
  }

  async function uploadRequirement(requirement: CommandPartnerPortalRequirement) {
    const draft = drafts[requirement.requirementType];
    if (!draft?.file) {
      setError("Choose a document before uploading.");
      setNotice("");
      return;
    }
    if (!draft.expiresAt) {
      setError("Expiry date is required before uploading a requirement document.");
      setNotice("");
      return;
    }

    setUploadingType(requirement.requirementType);
    setError("");
    setNotice("");

    try {
      const uploadSessionResponse = await fetch(
        `/api/bff/partners/requirements/${requirement.requirementType}/upload-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: draft.file.name,
            mimeType: draft.file.type,
            sizeBytes: draft.file.size,
          }),
        }
      );
      const uploadSessionBody = await uploadSessionResponse.json().catch(() => ({}));
      if (uploadSessionResponse.status === 401) {
        window.location.assign("/partners/signin?error=SessionExpired");
        return;
      }
      if (!uploadSessionResponse.ok || !uploadSessionBody?.ok || !uploadSessionBody?.upload) {
        throw new Error(uploadSessionBody?.error || "Failed to create requirement upload session.");
      }

      const uploadResult = await fetch(String(uploadSessionBody.upload.uploadUrl), {
        method: String(uploadSessionBody.upload.uploadMethod || "PUT"),
        headers: uploadSessionBody.upload.uploadHeaders || {},
        body: draft.file,
      });
      if (!uploadResult.ok) {
        throw new Error("Direct requirement upload failed.");
      }

      const finalizeResponse = await fetch(
        `/api/bff/partners/requirements/${requirement.requirementType}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectKey: uploadSessionBody.upload.objectKey,
            fileName: draft.file.name,
            mimeType: draft.file.type,
            sizeBytes: draft.file.size,
            expiresAt: draft.expiresAt,
          }),
        }
      );
      const finalizeBody = await finalizeResponse.json().catch(() => ({}));
      if (finalizeResponse.status === 401) {
        window.location.assign("/partners/signin?error=SessionExpired");
        return;
      }
      if (!finalizeResponse.ok || !finalizeBody?.ok || !finalizeBody?.requirement) {
        throw new Error(finalizeBody?.error || "Failed to finalize requirement upload.");
      }

      setPayload((current) => {
        if (!current) return current;
        return {
          ...current,
          requirements: current.requirements.map((entry) =>
            entry.requirementType === requirement.requirementType
              ? (finalizeBody.requirement as CommandPartnerPortalRequirement)
              : entry
          ),
        };
      });
      setDrafts((current) => ({
        ...current,
        [requirement.requirementType]: {
          file: null,
          expiresAt: draft.expiresAt,
        },
      }));
      setNotice(`${humanize(requirement.requirementType)} uploaded and submitted for review.`);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to upload requirement document.");
      setNotice("");
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="grid gap-1">
        <div className="text-base font-semibold text-neutral-900">Compliance Documents</div>
        <div className="text-sm text-neutral-600">
          Outstanding requirements do not block scheduling in v1, but they do remain visible to backoffice and on your portal.
        </div>
      </div>

      {loading ? <div className="text-sm text-neutral-600">Loading requirement status...</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div> : null}

      {!loading && payload?.requirements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">
          Entertainment partners do not have defined post-approval document requirements in v1.
        </div>
      ) : null}

      {payload?.requirements.length ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          {outstandingCount} outstanding requirement{outstandingCount === 1 ? "" : "s"} across{" "}
          {payload.requirements.length} applicable document type{payload.requirements.length === 1 ? "" : "s"}.
        </div>
      ) : null}

      <div className="grid gap-3">
        {payload?.requirements.map((requirement) => {
          const draft = drafts[requirement.requirementType] || { file: null, expiresAt: "" };
          return (
            <div key={requirement.requirementType} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="grid gap-1">
                  <div className="text-base font-semibold text-neutral-900">{humanize(requirement.requirementType)}</div>
                  <div className="text-sm text-neutral-600">
                    {requirement.asset?.fileName || "No document uploaded"} ·{" "}
                    {requirement.expiresAt ? `Expires ${new Date(requirement.expiresAt).toLocaleDateString()}` : "No expiry date"}
                  </div>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${requirementStateTone(requirement.state)}`}>
                  {humanize(requirement.state)}
                </span>
              </div>

              {requirement.reviewerNotes ? (
                <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                  <div className="font-medium text-neutral-900">Reviewer notes</div>
                  <div className="mt-1">{requirement.reviewerNotes}</div>
                </div>
              ) : null}

              {/* HUMAN-REVIEW: Wave 12 — compact document thumbnail, left-aligned under name */}
              {requirement.asset?.id && assetAccessCache[requirement.asset.id] ? (
                <div
                  className="mt-2 w-fit cursor-pointer overflow-hidden rounded-lg"
                  onClick={() => setLightboxAccess(assetAccessCache[requirement.asset!.id])}
                >
                  <DocumentPreview
                    url={assetAccessCache[requirement.asset.id].url}
                    mimeType={assetAccessCache[requirement.asset.id].mimeType}
                    fileName={assetAccessCache[requirement.asset.id].fileName}
                    height="48px"
                    onClick={() => setLightboxAccess(assetAccessCache[requirement.asset!.id])}
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-neutral-900">Replace document</span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [requirement.requirementType]: {
                          ...(current[requirement.requirementType] || { expiresAt: "" }),
                          file: event.target.files?.[0] || null,
                        },
                      }))
                    }
                    className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-neutral-900">Expiry date</span>
                  <input
                    type="date"
                    value={draft.expiresAt}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [requirement.requirementType]: {
                          ...(current[requirement.requirementType] || { file: null }),
                          expiresAt: event.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {requirement.asset?.id ? (
                    <button
                      type="button"
                      onClick={() => void openAsset(requirement.asset!.id)}
                      disabled={openingAssetId === requirement.asset.id}
                      className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-800 disabled:opacity-60"
                    >
                      {openingAssetId === requirement.asset.id ? "Opening..." : "Open Current"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void uploadRequirement(requirement)}
                    disabled={uploadingType === requirement.requirementType || !draft.file || !draft.expiresAt}
                    className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {uploadingType === requirement.requirementType ? "Uploading..." : requirement.asset ? "Replace" : "Upload"}
                  </button>
                </div>
              </div>

              {draft.file ? <div className="mt-2 text-xs text-neutral-600">Selected: {draft.file.name}</div> : null}
            </div>
          );
        })}
      </div>

      {/* HUMAN-REVIEW: Wave 12 — document lightbox */}
      {lightboxAccess ? (
        <DocumentLightbox access={lightboxAccess} onClose={() => setLightboxAccess(null)} />
      ) : null}
    </div>
  );
}
