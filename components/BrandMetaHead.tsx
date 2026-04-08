import Head from "next/head";

export default function BrandMetaHead() {
  return (
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico?v=4" sizes="any" />
      <link rel="shortcut icon" href="/favicon.ico?v=4" />
      <meta name="theme-color" content="#111111" />
    </Head>
  );
}
