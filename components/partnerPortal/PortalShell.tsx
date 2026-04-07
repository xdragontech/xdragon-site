import type { ReactNode } from "react";
import PublicSiteHeader from "../PublicSiteHeader";

export default function PortalShell(props: {
  title: string;
  subtitle: string;
  children: ReactNode;
  width?: "narrow" | "wide";
}) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <PublicSiteHeader />
      <main className="px-4 py-10">
        <div
          className={`mx-auto w-full ${
            props.width === "wide" ? "max-w-5xl" : "max-w-2xl"
          } rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm`}
        >
          <div className="grid gap-2 border-b border-neutral-200 pb-4">
            <h1 className="text-2xl font-semibold">{props.title}</h1>
            <p className="text-sm text-neutral-600">{props.subtitle}</p>
          </div>
          <div className="mt-6">{props.children}</div>
        </div>
      </main>
    </div>
  );
}
