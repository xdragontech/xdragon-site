import Head from "next/head";

type BrandHeadProps = {
  title?: string;
  description?: string;
};

export default function BrandHead({ title, description }: BrandHeadProps) {
  return (
    <Head>
      {title ? <title>{title}</title> : null}
      {description ? <meta name="description" content={description} /> : null}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" href="/favicon_symbol.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#111111" />
      <meta name="theme-color" content="#111111" />
    </Head>
  );
}
