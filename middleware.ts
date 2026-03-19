// middleware.ts
// Deterministic subdomain routing for both production and staging custom hosts.
// Do not rely solely on build-time env values for host pairing.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminHostFor, getAllowedHosts, getBrandSiteConfig, isAdminHost, publicHostFor } from "./lib/siteConfig";

function getHost(req: NextRequest): string {
  const xfHost = req.headers.get("x-forwarded-host") || "";
  const host = (xfHost || req.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  return host;
}

export default function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = getHost(req);
  const cfg = getBrandSiteConfig();

  // Never touch API routes. Also leave raw vercel preview domains alone.
  if (url.pathname.startsWith("/api") || host.endsWith(".vercel.app")) {
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

  // Normalize apex to production www.
  if (host === cfg.apexHost) {
    url.hostname = cfg.production.publicHost;
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
