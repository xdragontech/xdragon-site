// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Subdomain separation:
 * - Main site:  https://www.xdragon.tech
 * - Admin UI:   https://admin.xdragon.tech
 *
 * Goals:
 * - If someone hits /admin/* on www -> redirect to admin.xdragon.tech
 * - If someone hits /tools (or other non-admin pages) on admin -> redirect to www
 * - Protect /admin/* + /api/admin/* on admin host (ADMIN only)
 * - When redirecting to sign-in, preserve callbackUrl on the correct host to avoid "bounce to wrong host"
 */

function isHost(host: string | null, prefix: string) {
  return !!host && host.toLowerCase().startsWith(prefix);
}

function buildUrl(req: NextRequest, newHost: string, pathname: string, search: string) {
  const url = new URL(req.url);
  url.host = newHost;
  url.pathname = pathname;
  url.search = search || "";
  return url;
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;

  const isAdminHost = isHost(host, "admin.");
  const isWwwHost = isHost(host, "www.");
  const isRootHost = host.toLowerCase() === "xdragon.tech";

  const ADMIN_HOST = "admin.xdragon.tech";
  const WWW_HOST = "www.xdragon.tech";

  // --- Canonicalize root domain -> www (optional but recommended) ---
  // If you prefer xdragon.tech as canonical, swap this direction.
  if (isRootHost) {
    const url = buildUrl(req, WWW_HOST, pathname, search);
    return NextResponse.redirect(url, 308);
  }

  const isAdminPath = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isToolsPath = pathname === "/tools" || pathname.startsWith("/tools/");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public");

  // --- Keep admin pages on admin host ---
  if ((isAdminPath || isAdminApi) && (isWwwHost || isRootHost)) {
    const url = buildUrl(req, ADMIN_HOST, pathname, search);
    return NextResponse.redirect(url, 307);
  }

  // --- Keep non-admin pages on www host (optional but usually desired) ---
  // You can remove this block if you want admin subdomain to also serve the marketing site.
  if (isAdminHost && !isAdminPath && !isAdminApi && !isAuthApi && !isPublicAsset) {
    // Allow NextAuth API routes on admin host (same auth backend, different UI host).
    // Redirect everything else to www.
    const url = buildUrl(req, WWW_HOST, pathname, search);
    return NextResponse.redirect(url, 307);
  }

  // --- Protect admin routes (admin host only) ---
  if (isAdminHost && (isAdminPath || isAdminApi)) {
    // Allow access to the admin sign-in page without a session
    if (pathname === "/admin/signin") return NextResponse.next();

    // Read the NextAuth token (JWT strategy) from cookies
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // Not signed in -> go to admin sign-in with correct callbackUrl on admin host
    if (!token) {
      const callbackUrl = `https://${ADMIN_HOST}${pathname}${search || ""}`;
      const signin = new URL(`https://${ADMIN_HOST}/admin/signin`);
      signin.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(signin, 307);
    }

    // Signed in but not allowed (non-admin / blocked) -> sign-in with error
    const role = (token as any).role;
    const status = (token as any).status;

    if (status === "BLOCKED" || role !== "ADMIN") {
      const callbackUrl = `https://${ADMIN_HOST}${pathname}${search || ""}`;
      const signin = new URL(`https://${ADMIN_HOST}/admin/signin`);
      signin.searchParams.set("callbackUrl", callbackUrl);
      signin.searchParams.set("error", "AccessDenied");
      return NextResponse.redirect(signin, 307);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Admin UI + admin API
    "/admin/:path*",
    "/api/admin/:path*",
    // Optional host canonicalization / keep-only-on-www rules for tools
    "/tools/:path*",
    // NOTE: we intentionally do NOT match /api/auth/* to avoid interfering with NextAuth internals.
  ],
};
