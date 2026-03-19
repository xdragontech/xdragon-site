import type { ReactNode } from "react";
import WorkspaceLayout from "../backoffice/WorkspaceLayout";
import ResourcesHeader from "./ResourcesHeader";
import ResourcesSidebar from "./ResourcesSidebar";

type ResourcesLayoutProps = {
  title: string;
  sectionLabel: string;
  loggedInAs: string | null;
  active?: "resources" | "prompts" | "guides";
  children: ReactNode;
};

export default function ResourcesLayout({ title, sectionLabel, loggedInAs, active, children }: ResourcesLayoutProps) {
  return (
    <WorkspaceLayout
      title={title}
      header={<ResourcesHeader sectionLabel={sectionLabel} loggedInAs={loggedInAs} />}
      sidebar={<ResourcesSidebar active={active} />}
    >
      {children}
    </WorkspaceLayout>
  );
}
