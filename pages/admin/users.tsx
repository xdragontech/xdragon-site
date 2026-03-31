// pages/admin/users.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Deprecated route: /admin/users
 * The old dashboard surface has been retired from xdragon-site.
 * Keep this file temporarily to funnel old bookmarks through the
 * dashboard retirement route instead of hard failing.
 */
export default function AdminUsersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);
  return null;
}
