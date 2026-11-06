import { useEffect, useRef, useState } from "react";
import { useInstructionActions, useInstructionsQuery } from "./useInstructions";
import type { InstructionScope } from "../models/instruction";

export const useInstructionEditor = (
  scope: InstructionScope,
  open: boolean,
) => {
  const query = useInstructionsQuery(scope, open);
  const actions = useInstructionActions(scope);
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const saving = useRef(false);
  const documentId = scope.type === "document" ? scope.documentId : undefined;
  useEffect(() => {
    setDraft(undefined);
    setError("");
    setEditing(false);
  }, [scope.type, documentId, open]);
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
      setEditing(false);
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
    editing,
    startEditing: () => setEditing(true),
    cancel: () => {
      if (saving.current) return;
      setDraft(undefined);
      setError("");
      setEditing(false);
    },
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
