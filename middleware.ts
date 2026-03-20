// middleware.ts
// Deterministic subdomain routing for both production and staging custom hosts.
// Do not rely solely on build-time env values for host pairing.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMiddlewareRequestHost } from "./lib/requestHost";
import { adminHostFor, getAllowedHosts, isAdminHost, publicHostFor } from "./lib/siteConfig";

type MiddlewareRuntime = {
  canonicalPublicHost: string;
  canonicalAdminHost: string;
  isAdminHost: boolean;
};

async function fetchMiddlewareRuntime(req: NextRequest, host: string): Promise<{ loaded: boolean; runtime: MiddlewareRuntime | null }> {
  try {
    const url = new URL("/api/internal/brand-runtime", req.nextUrl.origin);
    url.searchParams.set("host", host);

    const res = await fetch(url.toString(), {
      headers: {
        "x-xdragon-runtime": "middleware",
      },
      cache: "no-store",
    });

    if (!res.ok) return { loaded: false, runtime: null };

    const payload = await res.json();
    const runtime = payload?.runtime;

    if (!runtime) return { loaded: true, runtime: null };

    return {
      loaded: true,
      runtime: {
        canonicalPublicHost: String(runtime.canonicalPublicHost || ""),
        canonicalAdminHost: String(runtime.canonicalAdminHost || ""),
        isAdminHost: Boolean(runtime.isAdminHost),
      },
    };
  } catch {
    return { loaded: false, runtime: null };
  }
}

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = getMiddlewareRequestHost(req);

  // Never touch API routes. Also leave raw vercel preview domains alone.
  if (url.pathname.startsWith("/api") || host.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  const runtimeState = await fetchMiddlewareRuntime(req, host);

  if (runtimeState.loaded) {
    const runtime = runtimeState.runtime;
    if (!runtime) {
      return NextResponse.next();
    }

    const isAdminPath = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
    const isRootPath = url.pathname === "/" || url.pathname === "";
    const onAdminHost = runtime.isAdminHost;

    if (onAdminHost && isRootPath) {
      url.pathname = "/admin/signin";
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }

    if (isAdminPath && !onAdminHost) {
      url.hostname = runtime.canonicalAdminHost;
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }

    if (!isAdminPath && onAdminHost) {
      url.hostname = runtime.canonicalPublicHost;
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }

    if (!onAdminHost && host !== runtime.canonicalPublicHost) {
      url.hostname = runtime.canonicalPublicHost;
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }

    return NextResponse.next();
  }

  // Unknown hosts should not be force-routed into the X Dragon pair.
  if (!getAllowedHosts().has(host)) {
    return NextResponse.next();
  }

  const isAdminPath = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  const isRootPath = url.pathname === "/" || url.pathname === "";
  const onAdminHost = isAdminHost(host);

  // Admin host root should always land on the admin sign-in route on the SAME host.
  if (onAdminHost && isRootPath) {
    url.pathname = "/admin/signin";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Admin routes must stay on the matching admin host for the current environment.
  if (isAdminPath && !onAdminHost) {
    url.hostname = adminHostFor(host);
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Non-admin routes should never stay on an admin host.
  if (!isAdminPath && onAdminHost) {
    url.hostname = publicHostFor(host);
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Normalize any public alias host to the canonical public host for the fallback env config.
  if (!onAdminHost && host !== publicHostFor(host)) {
    url.hostname = publicHostFor(host);
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/tools/:path*",
    "/prompts/:path*",
    "/guides/:path*",
    "/resources/:path*",
    "/auth/:path*",
    "/",
  ],
};
