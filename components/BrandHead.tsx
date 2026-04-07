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
      <link rel="icon" type="image/png" href="/favicon_symbol.png?v=2" />
      <link rel="shortcut icon" href="/favicon_symbol.png?v=2" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#111111" />
      <meta name="theme-color" content="#111111" />
    </Head>
  );
}
