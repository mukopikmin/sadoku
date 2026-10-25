import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { restoreDocumentRevision } from "../api/documentRevisions";
import {
  commentsQueryKey,
  documentRevisionsQueryKey,
  documentsQueryKey,
  previewDocumentQueryKey,
} from "./previewQueryKeys";

export const useDocumentRestore = (
  documentId: number,
  onRestored: () => void,
) => {
  const [confirmation, setConfirmation] = useState<{
    revisionId: number;
    expectedMarkdown: string | undefined;
  }>();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: NonNullable<typeof confirmation>) =>
      restoreDocumentRevision(
        documentId,
        input.revisionId,
        input.expectedMarkdown,
      ),
    onSuccess: async () => {
      await Promise.all([
        previewDocumentQueryKey(documentId),
        documentsQueryKey,
        documentRevisionsQueryKey(documentId),
        commentsQueryKey(documentId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      setConfirmation(undefined);
      onRestored();
    },
  });
  return {
    open: confirmation !== undefined,
    isPending: mutation.isPending,
    error: mutation.error?.message,
    request: (revisionId: number, expectedMarkdown: string | undefined) => {
      mutation.reset();
      setConfirmation({ revisionId, expectedMarkdown });
    },
    cancel: () => {
      if (!mutation.isPending) setConfirmation(undefined);
    },
    confirm: () => {
      if (confirmation && !mutation.isPending) mutation.mutate(confirmation);
    },
  };
};
