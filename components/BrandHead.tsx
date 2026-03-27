import Head from "next/head";

type BrandHeadProps = {
  title?: string;
  description?: string;
};

export default function BrandHead({ title, description }: BrandHeadProps) {
  const includeSiteChrome = !title && !description;

  return (
    <Head>
      {title ? <title>{title}</title> : null}
      {description ? <meta name="description" content={description} /> : null}
      {includeSiteChrome ? <meta name="viewport" content="width=device-width, initial-scale=1" /> : null}
      {includeSiteChrome ? <link rel="icon" href="/favicon.ico?v=2" sizes="any" /> : null}
      {includeSiteChrome ? <link rel="shortcut icon" href="/favicon.ico?v=2" /> : null}
      {includeSiteChrome ? <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" /> : null}
      {includeSiteChrome ? <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#111111" /> : null}
      {includeSiteChrome ? <meta name="theme-color" content="#111111" /> : null}
    </Head>
  );
}
