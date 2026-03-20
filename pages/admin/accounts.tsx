import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/admin/accounts/staff",
      permanent: false,
    },
  };
};

export default function AdminAccountsRedirectPage() {
  return null;
}
