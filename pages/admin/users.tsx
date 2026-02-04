// pages/admin/users.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Deprecated route: /admin/users
 * This app now uses /admin/dashboard as the dashboard page.
 * Keep this file temporarily to avoid breaking old bookmarks/links.
 * You can delete this file once you're confident nothing relies on /admin/users.
 */
export default function AdminUsersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);
  return null;
}
