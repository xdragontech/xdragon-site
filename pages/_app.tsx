import type { AppProps } from "next/app";
import "../styles/globals.css";
import ChatWidget from "../components/ChatWidget";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      {/* Global floating chat agent */}
      <ChatWidget />
    </>
  );
}
