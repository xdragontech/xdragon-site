// middleware.ts
// Deterministic subdomain routing for both production and staging custom hosts.
// Do not rely solely on build-time env values for host pairing.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROD_WWW_HOST = "www.xdragon.tech";
const PROD_ADMIN_HOST = "admin.xdragon.tech";
const STAGING_WWW_HOST = process.env.NEXT_PUBLIC_WWW_HOST || "staging.xdragon.tech";
const STAGING_ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST || "stg-admin.xdragon.tech";

function getHost(req: NextRequest): string {
  const xfHost = req.headers.get("x-forwarded-host") || "";
  const host = (xfHost || req.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  return host;
}

function isAdminHost(host: string): boolean {
  return host === PROD_ADMIN_HOST || host === STAGING_ADMIN_HOST;
}

function adminHostFor(host: string): string {
  if (host === STAGING_WWW_HOST || host === STAGING_ADMIN_HOST) return STAGING_ADMIN_HOST;
  return PROD_ADMIN_HOST;
}

function publicHostFor(host: string): string {
  if (host === STAGING_WWW_HOST || host === STAGING_ADMIN_HOST) return STAGING_WWW_HOST;
  return PROD_WWW_HOST;
}

export default function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = getHost(req);

  // Never touch API routes. Also leave raw vercel preview domains alone.
  if (url.pathname.startsWith("/api") || host.endsWith(".vercel.app")) {
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
  if (host === "xdragon.tech") {
    url.hostname = PROD_WWW_HOST;
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
