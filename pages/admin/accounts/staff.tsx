import type { GetServerSideProps } from "next";
import AccountsDirectoryPage, { fmtDate, type ManagedAccountRow } from "../../../components/admin/AccountsDirectoryPage";
import { requireBackofficePage } from "../../../lib/backofficeAuth";

type StaffAccountRow = ManagedAccountRow & {
  username?: string | null;
  email: string | null;
  role: "SUPERADMIN" | "STAFF";
  brandAccessCount?: number | null;
  brandKeys?: string[] | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireBackofficePage(ctx, {
    callbackUrl: "/admin/accounts/staff",
    superadminOnly: true,
  });
  if (!auth.ok) return auth.response;

  return { props: {} };
};

export default function StaffAccountsPage() {
  return (
    <AccountsDirectoryPage<StaffAccountRow>
      browserTitle="Admin • Staff Accounts"
      headerLabel="Accounts"
      heading="Staff Accounts"
      description="Manage staff and superadmin accounts for the shared backoffice."
      searchPlaceholder="Search username, email, role, brands, status…"
      exportBaseName="staff-accounts"
      listApiPath="/api/admin/users"
      itemApiBasePath="/api/admin/users"
      columns={[
        {
          header: "Username",
          render: (row) => (
            <>
              <div className="font-medium text-neutral-900">{row.username || "—"}</div>
              <div className="text-xs text-neutral-500">{row.id}</div>
            </>
          ),
        },
        {
          header: "Email",
          render: (row) => row.email || "—",
        },
        {
          header: "Role",
          render: (row) => row.role,
        },
        {
          header: "Brands",
          render: (row) =>
            Array.isArray(row.brandKeys) && row.brandKeys.length > 0
              ? row.brandKeys.join(", ")
              : (row.brandAccessCount || 0) > 0
                ? `${row.brandAccessCount} assigned`
                : "—",
        },
        {
          header: "Status",
          render: (row) => row.status,
        },
        {
          header: "Created",
          render: (row) => fmtDate(row.createdAt),
        },
      ]}
      exportFields={[
        { header: "id", get: (row) => row.id },
        { header: "username", get: (row) => row.username ?? "" },
        { header: "email", get: (row) => row.email ?? "" },
        { header: "role", get: (row) => row.role },
        { header: "status", get: (row) => row.status },
        { header: "brandAccessCount", get: (row) => row.brandAccessCount ?? "" },
        { header: "brandKeys", get: (row) => (Array.isArray(row.brandKeys) ? row.brandKeys.join(",") : "") },
        { header: "createdAt", get: (row) => row.createdAt ?? "" },
        { header: "lastLoginAt", get: (row) => row.lastLoginAt ?? "" },
      ]}
      searchText={(row) =>
        [
          row.username || "",
          row.email || "",
          row.role || "",
          row.status || "",
          Array.isArray(row.brandKeys) ? row.brandKeys.join(" ") : "",
        ].join(" ")
      }
    />
  );
}
