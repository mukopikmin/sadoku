import { useEffect, useRef, useState } from "react";
import { useInstructionActions } from "./useInstructions";
import type { DocumentInstruction } from "../models/instruction";

type EditorState =
  | { status: "closed" }
  | { status: "creating"; content: string; error: string }
  | { status: "editing"; id: number; content: string; error: string };

export const useInstructionEditor = (documentId: number, open: boolean) => {
  const actions = useInstructionActions(documentId);
  const [state, setState] = useState<EditorState>({ status: "closed" });
  const saving = useRef(false);
  useEffect(() => {
    setState({ status: "closed" });
  }, [documentId, open]);

  const save = async () => {
    if (state.status === "closed" || !state.content.trim() || saving.current) {
      return;
    }
    saving.current = true;
    try {
      if (state.status === "creating") await actions.create(state.content);
      else await actions.update({ id: state.id, content: state.content });
      setState({ status: "closed" });
    } catch (error) {
      setState({
        ...state,
        error: error instanceof Error
          ? error.message
          : "Failed to save instruction.",
      });
    } finally {
      saving.current = false;
    }
  };

  return {
    state,
    pending: actions.pending,
    create: () => setState({ status: "creating", content: "", error: "" }),
    edit: (instruction: DocumentInstruction) =>
      setState({
        status: "editing",
        id: instruction.id,
        content: instruction.content,
        error: "",
      }),
    cancel: () => setState({ status: "closed" }),
    change: (content: string) =>
      setState((current) =>
        current.status === "closed"
          ? current
          : { ...current, content, error: "" }
      ),
    save,
  };
};
