import type { ReactNode } from "react";

type BackofficeShellProps = {
  children: ReactNode;
};

export default function BackofficeShell({ children }: BackofficeShellProps) {
  return <>{children}</>;
}
