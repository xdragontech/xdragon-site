import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import "../styles/globals.css";
import BrandHead from "../components/BrandHead";
import { shouldRenderPublicChat } from "../lib/siteConfig";
import { ToastProvider } from "../components/ui/toast";

/**
 * Render the ChatWidget client-only (no SSR) to avoid hydration mismatches (React #425)
 * when the widget relies on browser-only APIs (window/localStorage) or dynamic values.
 *
 * NOTE: If your widget file is named differently, adjust the import path below.
 */
const ChatWidget = dynamic(() => import("../components/ChatWidget"), { ssr: false });

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const renderChatWidget = shouldRenderPublicChat(router.pathname);

  return (
    <ToastProvider>
      <BrandHead />
      <Component {...pageProps} />
      {renderChatWidget ? <ChatWidget /> : null}
    </ToastProvider>
  );
}
