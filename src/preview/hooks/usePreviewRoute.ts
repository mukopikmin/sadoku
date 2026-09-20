import { useMatchRoute, useRouterState } from "@tanstack/react-router";
import type { PreviewView } from "../components/layout/PreviewHeader";

export const parseDocumentId = (value: string | undefined) => {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
};

export const usePreviewRoute = () => {
  const matchRoute = useMatchRoute();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const commentsMatch = matchRoute({
    to: "/documents/$documentId/comments",
  });
  const previewMatch = matchRoute({ to: "/documents/$documentId" });
  const rawDocumentId = commentsMatch
    ? commentsMatch.documentId
    : previewMatch
    ? previewMatch.documentId
    : undefined;

  return {
    documentId: parseDocumentId(rawDocumentId),
    isDocumentList: pathname === "/",
    pathname,
    rawDocumentId,
    view: (commentsMatch ? "comments" : "preview") as PreviewView,
  };
};
