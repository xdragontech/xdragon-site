import Head from "next/head";

export default function BrandMetaHead() {
  return (
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
      <link rel="shortcut icon" href="/favicon.ico?v=3" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#111111" />
      <meta name="theme-color" content="#111111" />
    </Head>
  );
}
