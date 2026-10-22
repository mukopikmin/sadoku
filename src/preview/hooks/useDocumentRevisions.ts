import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  loadDocumentRevision,
  loadDocumentRevisions,
} from "../api/documentRevisions";
import type { DocumentRevisionSummary } from "../models/documentRevision";
import { changedRevisionLines } from "../markdown/revisionDiff";
import {
  documentRevisionQueryKey,
  documentRevisionsQueryKey,
} from "./previewQueryKeys";

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; revisions: DocumentRevisionSummary[] };

type RevisionState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; markdown: string };

type ComparisonState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unavailable" }
  | { status: "ready"; changes: ReturnType<typeof changedRevisionLines> };

/** Mounted only while the revision dialog is open; saved bodies are immutable. */
export const useDocumentRevisions = (documentId: number, markdown: string) => {
  const [selectedId, selectRevision] = useState<number>();
  const list = useQuery({
    queryKey: documentRevisionsQueryKey(documentId),
    queryFn: ({ signal }) => loadDocumentRevisions(documentId, signal),
    staleTime: 0,
  });
  // Current is compared with the latest saved revision. Saved revisions carry
  // their immediate predecessor, including predecessors outside the list of 20.
  const revisionId = selectedId ?? list.data?.[0]?.id;
  const selected = useQuery({
    queryKey: documentRevisionQueryKey(documentId, revisionId),
    queryFn: ({ signal }) =>
      loadDocumentRevision(documentId, revisionId!, signal),
    enabled: revisionId !== undefined,
    staleTime: Infinity,
  });
  const history: HistoryState = list.data
    ? list.data.length === 0
      ? { status: "empty" }
      : { status: "ready", revisions: list.data }
    : list.error
    ? { status: "error", message: list.error.message }
    : { status: "loading" };
  const content: RevisionState = selectedId === undefined
    ? { status: "ready", markdown }
    : selected.data
    ? { status: "ready", markdown: selected.data.markdown }
    : selected.error
    ? { status: "error", message: selected.error.message }
    : { status: "loading" };
  const previousMarkdown = selectedId === undefined
    ? selected.data?.markdown
    : selected.data?.previousMarkdown;
  const changes = useMemo(
    () =>
      content.status === "ready" && previousMarkdown !== undefined
        ? changedRevisionLines(previousMarkdown, content.markdown)
        : undefined,
    [
      content.status,
      content.status === "ready" ? content.markdown : undefined,
      previousMarkdown,
    ],
  );
  const comparison: ComparisonState = changes
    ? { status: "ready", changes }
    : selected.error
    ? { status: "error", message: selected.error.message }
    : revisionId !== undefined
    ? selected.data ? { status: "unavailable" } : { status: "loading" }
    : history.status === "error"
    ? history
    : history.status === "loading"
    ? { status: "loading" }
    : { status: "unavailable" };
  return {
    history,
    content,
    comparison,
    selectedId,
    selectRevision,
    retryHistory: () => {
      void list.refetch();
    },
    retryRevision: () => {
      void selected.refetch();
    },
    retryComparison: () => {
      if (revisionId === undefined) void list.refetch();
      else void selected.refetch();
    },
  };
};
