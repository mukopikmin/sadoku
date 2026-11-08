import { useEffect, useRef, useState } from "react";
import { useInstructionActions, useInstructionsQuery } from "./useInstructions";
import type { InstructionScope } from "../models/instruction";
import { type ActionState, errorMessage } from "../models/uiState";

type InstructionEditorState =
  | { status: "loading" }
  | { status: "load-error"; message: string }
  | ({ content: string; dirty: boolean } & (
      | { status: "ready" | "saving" }
      | { status: "save-error"; message: string }
    ));

export const useInstructionEditor = (
  documentId: InstructionScope,
  open: boolean,
) => {
  const query = useInstructionsQuery(documentId, open);
  const actions = useInstructionActions(documentId);
  const [draft, setDraft] = useState<string>();
  const [action, setAction] = useState<ActionState>({ status: "idle" });
  const saving = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    saving.current = false;
    setDraft(undefined);
    setAction({ status: "idle" });
    return () => {
      // Invalidate async work; this ref is a generation counter, not a DOM node.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [documentId, open]);
  const instruction = query.data?.[0];
  const savedContent = instruction?.content ?? "";
  const content = draft ?? savedContent;
  const dirty = content !== savedContent;
  const state: InstructionEditorState = query.isPending
    ? { status: "loading" }
    : query.error
      ? { status: "load-error", message: String(query.error) }
      : action.status === "pending"
        ? { status: "saving", content, dirty }
        : action.status === "error"
          ? { status: "save-error", content, dirty, message: action.message }
          : { status: "ready", content, dirty };
  const save = async () => {
    if (!open || !query.isSuccess || !dirty || saving.current) return;
    saving.current = true;
    const started = generation.current;
    setAction({ status: "pending" });
    try {
      if (!content.trim()) {
        if (instruction) await actions.delete(instruction.id);
      } else if (instruction)
        await actions.update({ id: instruction.id, content });
      else await actions.create(content);
      if (started === generation.current) {
        setDraft(undefined);
        setAction({ status: "idle" });
      }
    } catch (error) {
      if (started === generation.current)
        setAction({ status: "error", message: errorMessage(error) });
    } finally {
      if (started === generation.current) saving.current = false;
    }
  };
  return {
    state,
    save,
    change: (content: string) => {
      if (saving.current || !open || !query.isSuccess) return;
      setDraft(content);
      setAction({ status: "idle" });
    },
  };
};
