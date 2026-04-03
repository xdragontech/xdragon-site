import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import PortalShell from "./PortalShell";
import { PORTAL_CONFIG } from "./portalConfig";
import type { CommandPartnerPortalScope } from "../../lib/commandPublicApi";

export default function PortalVerifyPage(props: { scope: CommandPartnerPortalScope }) {
  const config = PORTAL_CONFIG[props.scope];
  const router = useRouter();
  const [state, setState] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const token = useMemo(() => {
    const q = router.query.token;
    if (typeof q === "string" && q.trim()) return q.trim();
    if (typeof window !== "undefined") {
      const next = new URLSearchParams(window.location.search).get("token");
      if (next && next.trim()) return next.trim();
    }
    return "";
  }, [router.query.token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!token) {
      const next = new URLSearchParams(window.location.search).get("token");
      if (!next) {
        setState("error");
        setMessage("Missing verification token. Please use the link from your email.");
      }
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setState("verifying");
        setMessage("Verifying your email...");

        const response = await fetch(`/api/bff/${props.scope}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Verification failed.");
        }

        if (cancelled) return;
        setState("success");
        setMessage("Your portal email is verified. Redirecting to sign in...");
        window.setTimeout(() => {
          router.replace(config.verifyRedirectPath);
        }, 1200);
      } catch (nextError: any) {
        if (cancelled) return;
        setState("error");
        setMessage(nextError?.message || "Verification failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [config.verifyRedirectPath, props.scope, router, token]);

  return (
    <PortalShell title={config.verifyHeading} subtitle={config.subtitle}>
      <div className="grid gap-4">
        <p className="text-sm text-neutral-700">{message || "Loading..."}</p>
        {state === "error" ? (
          <a
            href={config.verifyRedirectPath}
            className="inline-flex w-fit items-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Back to sign in
          </a>
        ) : null}
      </div>
    </PortalShell>
  );
}
