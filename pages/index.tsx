import Head from "next/head";
import BusinessWebsite from "../components/BusinessWebsite";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>X Dragon Technologies</title>
        <meta
          name="description"
          content="AI consulting, infrastructure management, and automation for startups through medium-sized businesses."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <BusinessWebsite />

      {/* Floating site chat agent */}
</>
  );
}