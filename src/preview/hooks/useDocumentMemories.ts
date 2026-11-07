import { useEffect, useRef, useState } from "react";
import type { DocumentMemory } from "../models/memory";
import { errorMessage, listState } from "../models/uiState";
import { useDeleteMemory, useMemoriesQuery } from "./useMemories";

type DeletionState =
  | { status: "idle" }
  | { status: "confirming" | "deleting"; memory: DocumentMemory }
  | { status: "error"; memory: DocumentMemory; message: string };

export const useDocumentMemories = (documentId: number, open: boolean) => {
  const query = useMemoriesQuery(documentId, open);
  const deletion = useDeleteMemory(documentId);
  const [state, setState] = useState<DeletionState>({ status: "idle" });
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    pending.current = false;
    setState({ status: "idle" });
    return () => {
      generation.current++;
    };
  }, [documentId, open]);
  return {
    list: listState(query),
    state,
    requestDelete: (memory: DocumentMemory) => {
      if (!pending.current && open) setState({ status: "confirming", memory });
    },
    cancel: () => {
      if (!pending.current) setState({ status: "idle" });
    },
    remove: async () => {
      if (state.status === "idle" || pending.current || !open) return;
      const { memory } = state;
      const started = generation.current;
      pending.current = true;
      setState({ status: "deleting", memory });
      try {
        await deletion.mutateAsync(memory.id);
        if (started === generation.current) setState({ status: "idle" });
      } catch (error) {
        if (started === generation.current)
          setState({ status: "error", memory, message: errorMessage(error) });
      } finally {
        if (started === generation.current) pending.current = false;
      }
    },
  };
};
