import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/admin/settings/configs",
      permanent: false,
    },
  };
};

export default function AdminSettingsRedirect() {
  return null;
}
