import Head from "next/head";
import dynamic from "next/dynamic";

// Render the entire marketing site client-side to eliminate hydration mismatch errors.
// (Fastest/safest mitigation; revisit later if you want SSR for SEO/perf.)
const BusinessWebsite = dynamic(() => import("../components/BusinessWebsite"), { ssr: false });

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
    </>
  );
}
