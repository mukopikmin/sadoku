import { useEffect, useMemo, useState } from "react";
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
  const [requestedId, selectRevision] = useState<number>();
  const list = useQuery({
    queryKey: documentRevisionsQueryKey(documentId),
    queryFn: ({ signal }) => loadDocumentRevisions(documentId, signal),
    staleTime: 0,
  });
  const latestId = list.data?.[0]?.id;
  const latest = useQuery({
    queryKey: documentRevisionQueryKey(documentId, latestId),
    queryFn: ({ signal }) =>
      loadDocumentRevision(documentId, latestId!, signal),
    enabled: latestId !== undefined,
    staleTime: Infinity,
  });
  const currentMatchesSaved = latest.data?.markdown === markdown;
  const selectedId = currentMatchesSaved && requestedId === latestId
    ? undefined
    : requestedId;
  useEffect(() => {
    if (
      currentMatchesSaved && requestedId !== undefined &&
      requestedId === latestId
    ) {
      selectRevision(undefined);
    }
  }, [currentMatchesSaved, requestedId, latestId]);
  const selected = useQuery({
    queryKey: documentRevisionQueryKey(documentId, selectedId),
    queryFn: ({ signal }) =>
      loadDocumentRevision(documentId, selectedId!, signal),
    enabled: selectedId !== undefined,
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
    ? currentMatchesSaved
      ? latest.data?.previousMarkdown
      : latest.data?.markdown
    : selected.data?.previousMarkdown;
  const revision = selectedId === undefined ? latest : selected;
  const revisionId = selectedId ?? latestId;
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
    : revision.error
    ? { status: "error", message: revision.error.message }
    : revisionId !== undefined
    ? revision.data ? { status: "unavailable" } : { status: "loading" }
    : history.status === "error"
    ? history
    : history.status === "loading"
    ? { status: "loading" }
    : { status: "unavailable" };
  return {
    history,
    content,
    comparison,
    showLatestSaved: latest.data !== undefined && !currentMatchesSaved,
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
      else void revision.refetch();
    },
  };
};
