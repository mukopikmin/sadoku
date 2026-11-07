import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { restoreDocumentRevision } from "../api/documentRevisions";
import { errorMessage } from "../models/uiState";
import {
  commentsQueryKey,
  documentRevisionsQueryKey,
  documentsQueryKey,
  previewDocumentQueryKey,
} from "./previewQueryKeys";

type RestoreInput = {
  revisionId: number;
  expectedMarkdown: string | undefined;
};
type RestoreState =
  | { status: "closed" }
  | { status: "confirming" | "restoring"; input: RestoreInput }
  | { status: "error"; input: RestoreInput; message: string };

export const useDocumentRestore = (
  documentId: number,
  onRestored: () => void,
) => {
  const [state, setState] = useState<RestoreState>({ status: "closed" });
  const pending = useRef(false);
  const generation = useRef(0);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      targetDocumentId,
      input,
    }: {
      targetDocumentId: number;
      input: RestoreInput;
    }) =>
      restoreDocumentRevision(
        targetDocumentId,
        input.revisionId,
        input.expectedMarkdown,
      ),
  });
  useEffect(() => {
    generation.current++;
    pending.current = false;
    setState({ status: "closed" });
    return () => {
      generation.current++;
    };
  }, [documentId]);
  return {
    state,
    request: (revisionId: number, expectedMarkdown: string | undefined) => {
      if (!pending.current)
        setState({
          status: "confirming",
          input: { revisionId, expectedMarkdown },
        });
    },
    cancel: () => {
      if (!pending.current) setState({ status: "closed" });
    },
    confirm: async () => {
      if (state.status === "closed" || pending.current) return;
      const { input } = state;
      const started = generation.current;
      pending.current = true;
      setState({ status: "restoring", input });
      try {
        await mutation.mutateAsync({ targetDocumentId: documentId, input });
        await Promise.all(
          [
            previewDocumentQueryKey(documentId),
            documentsQueryKey,
            documentRevisionsQueryKey(documentId),
            commentsQueryKey(documentId),
          ].map((queryKey) => client.invalidateQueries({ queryKey })),
        );
        if (started === generation.current) {
          setState({ status: "closed" });
          onRestored();
        }
      } catch (error) {
        if (started === generation.current)
          setState({ status: "error", input, message: errorMessage(error) });
      } finally {
        if (started === generation.current) pending.current = false;
      }
    },
  };
};
