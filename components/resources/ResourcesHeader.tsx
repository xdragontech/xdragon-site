import Head from "next/head";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";

type ResourcesHeaderProps = {
  sectionLabel: string;
  loggedInAs?: string | null;
  sessionMode?: "legacy" | "command";
};

export default function ResourcesHeader({
  sectionLabel,
  loggedInAs,
  sessionMode = "legacy",
}: ResourcesHeaderProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      if (sessionMode === "command") {
        await fetch("/api/bff/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        window.location.assign("/auth/signin");
        return;
      }

      await signOut({ callbackUrl: "/auth/signin" });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap" rel="stylesheet" />
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
                >
                  Resources
                </div>
              </div>

              <div className="flex h-11 items-center">
                <div className="text-sm text-neutral-600">{sectionLabel}</div>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="rounded-full border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                >
                  Main Site
                </Link>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800"
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>

              {loggedInAs ? <div className="mt-2 text-sm text-neutral-600">Logged in as: {loggedInAs}</div> : null}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
