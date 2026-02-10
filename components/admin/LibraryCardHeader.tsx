import React, { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actionsTop?: ReactNode;
  actionsBottom?: ReactNode;
};

/**
 * Standardized header for Library cards (Prompts/Guides/etc).
 * Locks the left title/description + right-aligned two-row actions layout
 * so future page changes don't accidentally regress alignment.
 */
export default function LibraryCardHeader({ title, description, actionsTop, actionsBottom }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
      </div>

      {(actionsTop || actionsBottom) ? (
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {actionsTop ? <div className="flex items-center justify-end gap-2 whitespace-nowrap">{actionsTop}</div> : null}
          {actionsBottom ? <div className="flex items-center justify-end gap-2 whitespace-nowrap">{actionsBottom}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
