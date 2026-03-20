import type { GetServerSideProps } from "next";
import AccountsDirectoryPage, { fmtDate, type ManagedAccountRow } from "../../../components/admin/AccountsDirectoryPage";
import { requireBackofficePage } from "../../../lib/backofficeAuth";

type ClientAccountRow = ManagedAccountRow & {
  name?: string | null;
  email: string | null;
  brandKey: string;
  brandName: string;
  emailVerifiedAt?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  legacyLinked?: boolean | null;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireBackofficePage(ctx, {
    callbackUrl: "/admin/accounts/clients",
    superadminOnly: true,
  });
  if (!auth.ok) return auth.response;

  return { props: {} };
};

export default function ClientAccountsPage() {
  return (
    <AccountsDirectoryPage<ClientAccountRow>
      browserTitle="Admin • Client Accounts"
      headerLabel="Accounts"
      heading="Client Accounts"
      description="Manage brand-scoped external client accounts for the public website."
      searchPlaceholder="Search name, email, brand, status, verification…"
      exportBaseName="client-accounts"
      listApiPath="/api/admin/client-accounts"
      itemApiBasePath="/api/admin/client-accounts"
      columns={[
        {
          header: "Client",
          render: (row) => (
            <>
              <div className="font-medium text-neutral-900">{row.name || row.email || "—"}</div>
              <div className="text-xs text-neutral-500">{row.id}</div>
            </>
          ),
        },
        {
          header: "Email",
          render: (row) => row.email || "—",
        },
        {
          header: "Brand",
          render: (row) => (
            <>
              <div className="font-medium text-neutral-900">{row.brandName}</div>
              <div className="text-xs text-neutral-500">{row.brandKey}</div>
            </>
          ),
        },
        {
          header: "Verified",
          render: (row) => (row.emailVerifiedAt ? fmtDate(row.emailVerifiedAt) : "No"),
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
        { header: "name", get: (row) => row.name ?? "" },
        { header: "email", get: (row) => row.email ?? "" },
        { header: "brandKey", get: (row) => row.brandKey },
        { header: "brandName", get: (row) => row.brandName },
        { header: "status", get: (row) => row.status },
        { header: "emailVerifiedAt", get: (row) => row.emailVerifiedAt ?? "" },
        { header: "createdAt", get: (row) => row.createdAt ?? "" },
        { header: "lastLoginAt", get: (row) => row.lastLoginAt ?? "" },
        { header: "legacyLinked", get: (row) => (row.legacyLinked ? "yes" : "no") },
      ]}
      searchText={(row) =>
        [
          row.name || "",
          row.email || "",
          row.brandKey || "",
          row.brandName || "",
          row.status || "",
          row.emailVerifiedAt ? "verified" : "unverified",
        ].join(" ")
      }
    />
  );
}
