import type { ReactNode } from "react";
import WorkspaceLayout from "../backoffice/WorkspaceLayout";
import ResourcesHeader from "./ResourcesHeader";
import ResourcesSidebar from "./ResourcesSidebar";

type ResourcesLayoutProps = {
  title: string;
  sectionLabel: string;
  loggedInAs: string | null;
  sessionMode?: "command";
  active?: "resources" | "prompts" | "guides";
  children: ReactNode;
};

export default function ResourcesLayout({
  title,
  sectionLabel,
  loggedInAs,
  sessionMode = "command",
  active,
  children,
}: ResourcesLayoutProps) {
  return (
    <WorkspaceLayout
      title={title}
      header={<ResourcesHeader sectionLabel={sectionLabel} loggedInAs={loggedInAs} sessionMode={sessionMode} />}
      sidebar={<ResourcesSidebar active={active} />}
    >
      {children}
    </WorkspaceLayout>
  );
}
