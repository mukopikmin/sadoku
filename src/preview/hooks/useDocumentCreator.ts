import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { createDocument, type CreateDocumentInput } from "../api/document";
import type { DocumentSummary } from "../models/document";
import { documentsQueryKey } from "./previewQueryKeys";

type CreatorState =
  | { status: "closed" }
  | { status: "editing" | "saving"; input: CreateDocumentInput }
  | { status: "error"; input: CreateDocumentInput; message: string };

export const useDocumentCreator = (onCreated: (id: number) => void) => {
  const [state, setState] = useState<CreatorState>({ status: "closed" });
  const submitting = useRef(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createDocument,
    onSuccess: (document) => {
      queryClient.setQueryData<DocumentSummary[]>(
        documentsQueryKey,
        (previous) =>
          [
            ...(previous ?? []).filter(({ id }) => id !== document.id),
            document,
          ].sort((left, right) =>
            left.relativePath.localeCompare(right.relativePath),
          ),
      );
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    },
  });
  return {
    state:
      state.status === "closed"
        ? state
        : {
            ...state,
            relativePath: [
              state.input.directory,
              state.input.filename.trim() &&
              !state.input.filename.trim().includes(".")
                ? `${state.input.filename.trim()}.md`
                : state.input.filename.trim(),
            ]
              .filter(Boolean)
              .join("/"),
          },
    open: (directory: string) => {
      if (submitting.current) return;
      setState({
        status: "editing",
        input: { directory, filename: "", title: "" },
      });
    },
    close: () => {
      if (!submitting.current) setState({ status: "closed" });
    },
    change: (field: "filename" | "title", value: string) => {
      if (submitting.current) return;
      setState((previous) =>
        previous.status === "closed"
          ? previous
          : {
              status: "editing",
              input: { ...previous.input, [field]: value },
            },
      );
    },
    save: async () => {
      if (
        state.status === "closed" ||
        submitting.current ||
        !state.input.filename.trim()
      )
        return;
      submitting.current = true;
      setState({ status: "saving", input: state.input });
      try {
        const document = await mutation.mutateAsync(state.input);
        setState({ status: "closed" });
        onCreated(document.id);
      } catch (error) {
        setState({
          status: "error",
          input: state.input,
          message:
            error instanceof Error ? error.message : "Failed to create file.",
        });
      } finally {
        submitting.current = false;
      }
    },
  };
};
