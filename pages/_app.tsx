import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import "../styles/globals.css";

/**
 * Render the ChatWidget client-only (no SSR) to avoid hydration mismatches (React #425)
 * when the widget relies on browser-only APIs (window/localStorage) or dynamic values.
 *
 * NOTE: If your widget file is named differently, adjust the import path below.
 */
const ChatWidget = dynamic(() => import("../components/ChatWidget"), { ssr: false });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <ChatWidget />
    </>
  );
}
