import type { ReactNode } from "react";
import BrandHead from "../BrandHead";
import { ToastProvider } from "../ui/toast";
import { getAppArea } from "../../lib/appArea";
import BackofficeShell from "./BackofficeShell";
import PublicSiteShell from "./PublicSiteShell";

type AppShellProps = {
  pathname: string;
  children: ReactNode;
};

export default function AppShell({ pathname, children }: AppShellProps) {
  const area = getAppArea(pathname);

  return (
    <ToastProvider>
      {area === "backoffice" ? (
        <BackofficeShell>{children}</BackofficeShell>
      ) : (
        <>
          <BrandHead />
          <PublicSiteShell>{children}</PublicSiteShell>
        </>
      )}
    </ToastProvider>
  );
}
