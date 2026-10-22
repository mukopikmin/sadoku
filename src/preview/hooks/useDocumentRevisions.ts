import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  loadDocumentRevision,
  loadDocumentRevisions,
} from "../api/documentRevisions";
import type { DocumentRevisionSummary } from "../models/documentRevision";
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

/** Mounted only while the revision dialog is open; saved bodies are immutable. */
export const useDocumentRevisions = (documentId: number, markdown: string) => {
  const [selectedId, selectRevision] = useState<number>();
  const list = useQuery({
    queryKey: documentRevisionsQueryKey(documentId),
    queryFn: ({ signal }) => loadDocumentRevisions(documentId, signal),
    staleTime: 0,
  });
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
  return {
    history,
    content,
    selectedId,
    selectRevision,
    retryHistory: () => {
      void list.refetch();
    },
    retryRevision: () => {
      void selected.refetch();
    },
  };
};
