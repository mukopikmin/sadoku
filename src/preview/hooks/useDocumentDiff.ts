import { useMemo, useState } from "react";
import { changedRevisionLines } from "../markdown/revisionDiff";

export const useDocumentDiff = (
  documentId: number,
  markdown: string,
  previousMarkdown?: string,
) => {
  const [enabledDocumentId, setEnabledDocumentId] = useState<number>();
  const available = previousMarkdown !== undefined;
  const enabled = available && enabledDocumentId === documentId;
  const changes = useMemo(
    () =>
      enabled ? changedRevisionLines(previousMarkdown!, markdown) : undefined,
    [enabled, previousMarkdown, markdown],
  );
  return {
    available,
    enabled,
    changes,
    onToggle: () => {
      if (available) setEnabledDocumentId(enabled ? undefined : documentId);
    },
  };
};
