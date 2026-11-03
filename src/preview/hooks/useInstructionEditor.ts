import { useEffect, useRef, useState } from "react";
import { useInstructionActions, useInstructionsQuery } from "./useInstructions";
import type { InstructionScope } from "../models/instruction";

export const useInstructionEditor = (
  documentId: InstructionScope,
  open: boolean,
) => {
  const query = useInstructionsQuery(documentId, open);
  const actions = useInstructionActions(documentId);
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState("");
  const saving = useRef(false);
  useEffect(() => {
    setDraft(undefined);
    setError("");
  }, [documentId, open]);
  const instruction = query.data?.[0];
  const savedContent = instruction?.content ?? "";
  const content = draft ?? savedContent;
  const dirty = content !== savedContent;

  const save = async () => {
    if (!query.isSuccess || !dirty || saving.current) return;
    saving.current = true;
    setError("");
    try {
      if (!content.trim()) {
        if (instruction) await actions.delete(instruction.id);
      } else if (instruction) {
        await actions.update({ id: instruction.id, content });
      } else {
        await actions.create(content);
      }
      setDraft(undefined);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to save instruction.",
      );
    } finally {
      saving.current = false;
    }
  };

  return {
    query,
    content,
    error,
    dirty,
    pending: actions.pending,
    change: (content: string) => {
      setDraft(content);
      setError("");
    },
    save,
  };
};
