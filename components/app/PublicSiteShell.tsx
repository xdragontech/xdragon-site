import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const ChatWidget = dynamic(() => import("../ChatWidget"), { ssr: false });
const WebsiteAnalyticsManager = dynamic(() => import("./WebsiteAnalyticsManager"), { ssr: false });

type PublicSiteShellProps = {
  children: ReactNode;
};

export default function PublicSiteShell({ children }: PublicSiteShellProps) {
  return (
    <>
      {children}
      <WebsiteAnalyticsManager />
      <ChatWidget />
    </>
  );
}
