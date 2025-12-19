import Head from "next/head";
import BusinessWebsite from "@/components/BusinessWebsite";

export default function Home() {
  return (
    <>
      <Head>
        <title>X Dragon Technologies</title>
        <meta
          name="description"
          content="X Dragon provides leading AI consulting as well as Infrastructure Management for E-commerce operators."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Favicons / icons (place files in /public) */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
        <link rel="icon" type="image/png" href="/favicon_symbol.png" />
        <link
          rel="icon"
          type="image/png"
          href="/favicon_symbol-dark.png"
          media="(prefers-color-scheme: dark)"
        />
        <meta name="theme-color" content="#000000" />
      </Head>

      <BusinessWebsite />
    </>
  );
}
