import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import "../styles/globals.css";
import AppShell from "../components/app/AppShell";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <AppShell pathname={router.pathname}>
      <Component {...pageProps} />
    </AppShell>
  );
}
