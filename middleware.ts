// middleware.ts
// Subdomain routing guard for a single Vercel project serving BOTH:
// - Main site: https://www.xdragon.tech (or staging.xdragon.tech in Preview)
// - Admin console: https://admin.xdragon.tech (or stg-admin.xdragon.tech in Preview)
//
// Goals:
// - Never redirect /api/* (especially /api/auth/*), to avoid auth loops.
// - Only redirect when you're on the *wrong* host for a given path.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WWW_HOST = process.env.NEXT_PUBLIC_WWW_HOST || "www.xdragon.tech";
const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST || "admin.xdragon.tech";

function getHost(req: NextRequest): string {
  const xfHost = req.headers.get("x-forwarded-host") || "";
  const host = (xfHost || req.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  return host;
}

export default function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = getHost(req);

  // Safety: never touch API routes (prevents NextAuth redirect loops)
  if (url.pathname.startsWith("/api")) return NextResponse.next();

  const isAdminPath = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  const isRootPath = url.pathname === "/" || url.pathname === "";

  // Visiting the admin host root should land on the admin sign-in page.
  // The page itself will forward authenticated users to /admin/dashboard.
  if (host === ADMIN_HOST && isRootPath) {
    url.pathname = "/admin/signin";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Admin console should only live on the configured admin host.
  if (isAdminPath && host !== ADMIN_HOST) {
    url.hostname = ADMIN_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Main site should NOT serve admin routes.
  if (!isAdminPath && host === ADMIN_HOST) {
    url.hostname = WWW_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Optional: normalize apex -> www if you have xdragon.tech attached.
  if (host === "xdragon.tech") {
    url.hostname = WWW_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Only run where we need it.
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
