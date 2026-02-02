// middleware.ts
// Subdomain routing guard for a single Vercel project serving BOTH:
// - Main site: https://www.xdragon.tech
// - Admin console: https://admin.xdragon.tech
//
// Goals:
// - Never redirect /api/* (especially /api/auth/*), to avoid auth loops.
// - Only redirect when you're on the *wrong* host for a given path.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WWW_HOST = "www.xdragon.tech";
const ADMIN_HOST = "admin.xdragon.tech";

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

  // Admin console should only live on admin.xdragon.tech
  if (isAdminPath && host !== ADMIN_HOST) {
    url.hostname = ADMIN_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Main site should NOT serve admin routes
  if (!isAdminPath && host === ADMIN_HOST) {
    url.hostname = WWW_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Optional: normalize apex -> www if you have xdragon.tech attached
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
    "/tools",
    "/auth/:path*",
    "/",
  ],
};
