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
    </Head>
  );
}
