import dynamic from "next/dynamic";
import BrandHead from "../components/BrandHead";

// Render the entire marketing site client-side to eliminate hydration mismatch errors.
// (Fastest/safest mitigation; revisit later if you want SSR for SEO/perf.)
const BusinessWebsite = dynamic(() => import("../components/BusinessWebsite"), { ssr: false });

export default function HomePage() {
  return (
    <>
      <BrandHead
        title="X Dragon Technologies"
        description="AI consulting, infrastructure management, and automation for startups through medium-sized businesses."
      />

      <BusinessWebsite />
    </>
  );
}
