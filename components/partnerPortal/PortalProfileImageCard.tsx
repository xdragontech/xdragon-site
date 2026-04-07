import { useEffect, useMemo, useState } from "react";
import type {
  CommandPartnerAssetSummary,
  CommandPartnerPortalScope,
} from "../../lib/commandPublicApi";

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.width, height: image.height });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

export default function PortalProfileImageCard(props: {
  scope: CommandPartnerPortalScope;
}) {
  const [asset, setAsset] = useState<CommandPartnerAssetSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/bff/${props.scope}/profile/image`);
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to load profile image.");
      }
      setAsset((payload.asset || null) as CommandPartnerAssetSummary | null);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to load profile image.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [props.scope]);

  const heading = useMemo(() => {
    return props.scope === "partners" ? "Profile Image" : "Sponsor Image";
  }, [props.scope]);

  async function uploadSelectedFile() {
    if (!selectedFile) {
      setError("Choose an image file first.");
      setNotice("");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");

    try {
      const sessionResponse = await fetch(`/api/bff/${props.scope}/profile/image/upload-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
        }),
      });
      const sessionPayload = await sessionResponse.json().catch(() => ({}));
      if (sessionResponse.status === 401) {
        window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
        return;
      }
      if (!sessionResponse.ok || !sessionPayload?.ok || !sessionPayload?.upload) {
        throw new Error(sessionPayload?.error || "Failed to create image upload session.");
      }

      const uploadResult = await fetch(String(sessionPayload.upload.uploadUrl), {
        method: String(sessionPayload.upload.uploadMethod || "PUT"),
        headers: sessionPayload.upload.uploadHeaders || {},
        body: selectedFile,
      });
      if (!uploadResult.ok) {
        throw new Error("Direct image upload failed.");
      }

      const dimensions = await readImageDimensions(selectedFile);
      const finalizeResponse = await fetch(`/api/bff/${props.scope}/profile/image/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey: sessionPayload.upload.objectKey,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
          imageWidth: dimensions?.width ?? null,
          imageHeight: dimensions?.height ?? null,
        }),
      });
      const finalizePayload = await finalizeResponse.json().catch(() => ({}));
      if (finalizeResponse.status === 401) {
        window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
        return;
      }
      if (!finalizeResponse.ok || !finalizePayload?.ok || !finalizePayload?.asset) {
        throw new Error(finalizePayload?.error || "Failed to finalize image upload.");
      }

      setAsset(finalizePayload.asset as CommandPartnerAssetSummary);
      setSelectedFile(null);
      setNotice("Profile image uploaded.");
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to upload profile image.");
      setNotice("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="grid gap-1">
        <div className="text-base font-semibold text-neutral-900">{heading}</div>
        <div className="text-sm text-neutral-600">
          Public profile images are stored as public media and can be reused later in frontend feeds.
        </div>
      </div>

      {loading ? <div className="text-sm text-neutral-600">Loading image...</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div> : null}

      {asset?.publicUrl ? (
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
          <img
            src={asset.publicUrl}
            alt={`${heading} preview`}
            className="h-40 w-full rounded-2xl border border-neutral-200 bg-white object-cover"
          />
          <div className="grid gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <div className="font-medium text-neutral-900">{asset.fileName}</div>
            <div>{asset.mimeType}</div>
            <div>{Math.round(asset.sizeBytes / 1024)} KB</div>
            <div>{asset.imageWidth && asset.imageHeight ? `${asset.imageWidth} × ${asset.imageHeight}` : "Dimensions not recorded"}</div>
          </div>
        </div>
      ) : !loading ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">
          No profile image uploaded yet.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-900">Choose image</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </label>
        <button
          type="button"
          onClick={() => void uploadSelectedFile()}
          disabled={uploading || !selectedFile}
          className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {uploading ? "Uploading..." : asset ? "Replace Image" : "Upload Image"}
        </button>
      </div>
      {selectedFile ? <div className="text-xs text-neutral-600">Selected: {selectedFile.name}</div> : null}
    </div>
  );
}
