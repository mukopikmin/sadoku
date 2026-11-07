import { useEffect, useMemo, useRef, useState } from "react";
import type { TagPickerOption } from "../components/ui/TagPicker";
import type { TagReference } from "../api/tags";
import type { DocumentTag } from "../models/document";
import { findSimilarTags } from "../models/tagSuggestions";
import { errorMessage, listState } from "../models/uiState";
import { useTagActions, useTagsQuery } from "./useTags";

type Draft = { tags: DocumentTag[]; input: string };
type TagEditorState = Draft &
  (
    | { status: "editing" }
    | { status: "saving" }
    | { status: "error"; message: string }
  );

export const useDocumentTagEditor = (
  documentId: number,
  open: boolean,
  tags: DocumentTag[],
) => {
  const query = useTagsQuery(open);
  const actions = useTagActions(documentId);
  const [state, setState] = useState<TagEditorState>({
    status: "editing",
    tags,
    input: "",
  });
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    pending.current = false;
    setState({ status: "editing", tags, input: "" });
    return () => {
      generation.current++;
    };
  }, [documentId, open, tags]);
  const allTags = query.data ?? [];
  const trimmed = state.input.trim();
  const exact = allTags.find(({ name }) => name === trimmed);
  const options = useMemo(() => {
    const available = allTags.filter(
      ({ id }) => !state.tags.some((tag) => tag.id === id),
    );
    const matching = trimmed
      ? [
          ...available.filter(({ name }) => name === trimmed),
          ...findSimilarTags(state.input, available, available.length),
        ]
      : available;
    const items: TagPickerOption[] = matching.map((tag) => ({
      value: String(tag.id),
      label: tag.name,
      tag,
    }));
    if (trimmed && !exact && !state.tags.some(({ name }) => name === trimmed)) {
      items.push({ value: "create", label: `Create “${trimmed}”` });
    }
    return items;
  }, [allTags, state.tags, state.input, trimmed, exact]);
  const fail = (message: string) =>
    setState((current) => ({ ...current, status: "error", message }));
  const persist = async (next: TagReference[]) => {
    if (pending.current) return;
    pending.current = true;
    const started = generation.current;
    setState((current) => ({
      status: "saving",
      tags: current.tags,
      input: current.input,
    }));
    try {
      const saved = await actions.replace(next);
      if (started === generation.current)
        setState({ status: "editing", tags: saved, input: "" });
    } catch (error) {
      if (started === generation.current) fail(errorMessage(error));
    } finally {
      if (started === generation.current) pending.current = false;
    }
  };
  const add = (tag: DocumentTag) => {
    if (pending.current || !open || !query.isSuccess) return;
    if (state.tags.some(({ id }) => id === tag.id))
      return fail("This tag has already been added.");
    if (state.tags.length >= 20)
      return fail("A document can have at most 20 tags.");
    void persist([...state.tags.map(({ id }) => ({ id })), { id: tag.id }]);
  };
  const submit = () => {
    if (!trimmed || pending.current || !open || !query.isSuccess) return;
    if (/\p{Cc}/u.test(trimmed))
      return fail(
        "Tag names cannot contain line breaks or control characters.",
      );
    if ([...trimmed].length > 50)
      return fail("Tag names can contain at most 50 characters.");
    if (exact) return add(exact);
    if (state.tags.some(({ name }) => name === trimmed))
      return fail("This tag has already been added.");
    if (state.tags.length >= 20)
      return fail("A document can have at most 20 tags.");
    void persist([...state.tags.map(({ id }) => ({ id })), { name: trimmed }]);
  };
  return {
    state,
    options,
    list: listState(query),
    change: (input: string) => {
      if (!pending.current)
        setState((current) => ({
          status: "editing",
          tags: current.tags,
          input,
        }));
    },
    add,
    submit,
    remove: (tag: DocumentTag) => {
      if (open && query.isSuccess)
        void persist(
          state.tags
            .filter(({ id }) => id !== tag.id)
            .map(({ id }) => ({ id })),
        );
    },
  };
};
