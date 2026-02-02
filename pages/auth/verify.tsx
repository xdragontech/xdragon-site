import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

/**
 * /auth/verify
 * Expects: ?token=...
 *
 * Robust against Next.js router query hydration timing by also reading
 * from window.location.search on the client.
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const token = useMemo(() => {
    // 1) Next router (when ready)
    const q = router?.query?.token;
    if (typeof q === "string" && q.trim()) return q.trim();

    // 2) Client-side URLSearchParams fallback (handles initial query empty)
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("token");
      if (t && t.trim()) return t.trim();
    }
    return "";
  }, [router?.query?.token]);

  useEffect(() => {
    // Wait for client to mount; router.isReady helps but isn't perfect alone
    if (typeof window === "undefined") return;

    if (!token) {
      // Don't flash an error while router is still populating the query.
      // If it's still empty after mount, show the error.
      const t = new URLSearchParams(window.location.search).get("token");
      if (!t) {
        setState("error");
        setMessage("Missing verification token. Please use the link from your email.");
      }
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setState("verifying");
        setMessage("Verifying your email…");

        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          const errMsg =
            data?.error ||
            (res.status === 410
              ? "This verification link has expired. Please sign up again."
              : "Verification failed. Please request a new link.");
          throw new Error(errMsg);
        }

        if (cancelled) return;

        setState("success");
        setMessage("You're verified — you can now log in.");

        // Small pause, then send them to the login page (or tools)
        setTimeout(() => {
          router.replace("/auth/signin");
        }, 1200);
      } catch (e: any) {
        if (cancelled) return;
        setState("error");
        setMessage(e?.message || "Verification failed. Please request a new link.");
      }
    })();

    return () => {
      cancelled = true
    };
  }, [token, router]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Email Verification</h1>
        <p className="mt-3 text-sm text-neutral-700">{message || "Loading…"}</p>

        {state === "error" && (
          <div className="mt-4">
            <a
              href="/auth/signin"
              className="inline-flex items-center justify-center rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold"
            >
              Back to Sign In
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
