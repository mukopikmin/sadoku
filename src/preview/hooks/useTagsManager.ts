import { useEffect, useRef, useState } from "react";
import { errorMessage, listState } from "../models/uiState";
import { useDeleteTag, useTagsQuery, useUpdateTag } from "./useTags";

type TagInput = { id: number; name: string; backgroundColor: string };
type ManagerState =
  | { status: "idle" }
  | { status: "editing" | "saving"; input: TagInput }
  | { status: "edit-error"; input: TagInput; message: string }
  | { status: "confirming-delete" | "deleting"; id: number }
  | { status: "delete-error"; id: number; message: string };

export const useTagsManager = (open: boolean) => {
  const query = useTagsQuery(open);
  const update = useUpdateTag();
  const remove = useDeleteTag();
  const [state, setState] = useState<ManagerState>({ status: "idle" });
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    pending.current = false;
    setState({ status: "idle" });
    return () => {
      // Invalidate async work; this ref is a generation counter, not a DOM node.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [open]);
  const cancel = () => {
    if (!pending.current) setState({ status: "idle" });
  };
  const save = async () => {
    if (!("input" in state) || pending.current || !open) return;
    const { input } = state;
    const started = generation.current;
    pending.current = true;
    setState({ status: "saving", input });
    try {
      await update.mutateAsync(input);
      if (started === generation.current) setState({ status: "idle" });
    } catch (error) {
      if (started === generation.current)
        setState({ status: "edit-error", input, message: errorMessage(error) });
    } finally {
      if (started === generation.current) pending.current = false;
    }
  };
  const deleteSelected = async () => {
    if (!("id" in state) || pending.current || !open) return;
    const { id } = state;
    const started = generation.current;
    pending.current = true;
    setState({ status: "deleting", id });
    try {
      await remove.mutateAsync(id);
      if (started === generation.current) setState({ status: "idle" });
    } catch (error) {
      if (started === generation.current)
        setState({ status: "delete-error", id, message: errorMessage(error) });
    } finally {
      if (started === generation.current) pending.current = false;
    }
  };
  return {
    state,
    list: listState(query),
    selectedTag:
      "id" in state ? query.data?.find(({ id }) => id === state.id) : undefined,
    edit: (input: TagInput) => {
      if (!pending.current) setState({ status: "editing", input });
    },
    change: (changes: Partial<Omit<TagInput, "id">>) => {
      if (!pending.current && "input" in state)
        setState({ status: "editing", input: { ...state.input, ...changes } });
    },
    requestDelete: (id: number) => {
      if (!pending.current) setState({ status: "confirming-delete", id });
    },
    cancel,
    save,
    deleteSelected,
  };
};
