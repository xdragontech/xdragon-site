import Head from "next/head";
import { signOut } from "next-auth/react";

type AdminHeaderProps = {
  sectionLabel: string;
  loggedInAs?: string | null;
};

export default function AdminHeader({ sectionLabel, loggedInAs }: AdminHeaderProps) {
  return (
    <>
      <Head>
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
                >
                  Command
                </div>
              </div>

              <div className="flex h-11 items-center">
                <div className="text-sm text-neutral-600">{sectionLabel}</div>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <button
                onClick={() => signOut({ callbackUrl: "/admin/signin" })}
                className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Sign out
              </button>
              {loggedInAs ? <div className="mt-2 text-sm text-neutral-600">Logged in as: {loggedInAs}</div> : null}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
