import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../models/uiState";

export type TextEditorState =
  | { status: "closed" }
  | { status: "editing" | "saving"; draft: string }
  | { status: "error"; draft: string; message: string };

type Options = {
  initialValue?: string;
  initiallyOpen?: boolean;
  allowEmpty?: boolean;
  scope?: string | number;
  onSave: (draft: string) => Promise<void | boolean>;
  onSaved?: () => void;
};

export const useTextEditor = ({
  initialValue = "",
  initiallyOpen = true,
  allowEmpty = false,
  scope,
  onSave,
  onSaved,
}: Options) => {
  const [state, setState] = useState<TextEditorState>(() =>
    initiallyOpen
      ? { status: "editing", draft: initialValue }
      : { status: "closed" },
  );
  const pending = useRef(false);
  const generation = useRef(0);
  // Prop refreshes preserve unsaved edits; a different scope starts a new editor.
  useEffect(() => {
    generation.current++;
    pending.current = false;
    setState(
      initiallyOpen
        ? { status: "editing", draft: initialValue }
        : { status: "closed" },
    );
    return () => {
      // Invalidate async work; this ref is a generation counter, not a DOM node.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
    // Only a scope change resets the editor; refreshed props preserve its draft.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  return {
    state,
    open: (draft = initialValue) => {
      if (!pending.current) setState({ status: "editing", draft });
    },
    close: () => {
      if (!pending.current) setState({ status: "closed" });
    },
    change: (draft: string) => {
      if (!pending.current && state.status !== "closed")
        setState({ status: "editing", draft });
    },
    save: async () => {
      if (
        state.status === "closed" ||
        pending.current ||
        (!allowEmpty && !state.draft.trim())
      )
        return false;
      const { draft } = state;
      const started = generation.current;
      pending.current = true;
      setState({ status: "saving", draft });
      try {
        const saved = await onSave(draft);
        if (started !== generation.current) return false;
        if (saved === false) {
          setState({ status: "editing", draft });
          return false;
        }
        setState({ status: "closed" });
        onSaved?.();
        return true;
      } catch (error) {
        if (started === generation.current)
          setState({ status: "error", draft, message: errorMessage(error) });
        return false;
      } finally {
        if (started === generation.current) pending.current = false;
      }
    },
  };
};
