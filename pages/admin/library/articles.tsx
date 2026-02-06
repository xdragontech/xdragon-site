import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return { redirect: { destination: "/admin/library/guides", permanent: false } };
};

export default function AdminLibraryArticlesRedirect() {
  return null;
}
