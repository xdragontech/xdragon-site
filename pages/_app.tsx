import type { AppProps } from "next/app";
import { ToastProvider } from "../components/ui/toast";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ToastProvider>
      <Component {...pageProps} />
    </ToastProvider>
  );
}
