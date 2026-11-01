import {
  CloseButton,
  createListCollection,
  Dialog,
  Flex,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TagReference } from "../api/tags";
import { useTagActions, useTagsQuery } from "../hooks/useTags";
import type { DocumentTag } from "../models/document";
import { findSimilarTags } from "../models/tagSuggestions";
import { TagPicker, type TagPickerOption } from "./ui/TagPicker";

type Props = {
  documentId: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tags: DocumentTag[];
};

export const DocumentTagsDialog = (
  { documentId, onOpenChange, open, tags }: Props,
) => {
  const query = useTagsQuery(open);
  const actions = useTagActions(documentId);
  const [selectedTags, setSelectedTags] = useState<DocumentTag[]>(tags);
  const saving = useRef(false);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (open) {
      setSelectedTags(tags);
      setInput("");
      setMessage("");
    }
  }, [open, tags]);

  const allTags = query.data ?? [];
  const trimmed = input.trim();
  const exact = allTags.find(({ name }) => name === trimmed);
  const collection = useMemo(() => {
    const selectedIds = new Set(selectedTags.map(({ id }) => id));
    const available = allTags.filter(({ id }) => !selectedIds.has(id));
    const matching = trimmed
      ? [
        ...available.filter(({ name }) => name === trimmed),
        ...findSimilarTags(input, available, available.length),
      ]
      : available;
    const items: TagPickerOption[] = matching.map((tag) => ({
      value: String(tag.id),
      label: tag.name,
      tag,
    }));
    if (
      trimmed && !exact && !selectedTags.some(({ name }) => name === trimmed)
    ) {
      items.push({ value: "create", label: `Create “${trimmed}”` });
    }
    return createListCollection({
      items,
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
      isItemDisabled: () => selectedTags.length >= 20,
    });
  }, [input, allTags, selectedTags]);
  const hasSelected = (tag: DocumentTag) =>
    selectedTags.some((item) => item.id === tag.id);

  const persist = async (next: TagReference[]) => {
    if (saving.current) return;
    saving.current = true;
    setMessage("");
    try {
      setSelectedTags(await actions.replace(next));
      setInput("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save tags.",
      );
    } finally {
      saving.current = false;
    }
  };
  const addExisting = (tag: DocumentTag) => {
    if (saving.current) return;
    if (hasSelected(tag)) {
      setMessage("This tag has already been added.");
      return;
    }
    if (selectedTags.length >= 20) {
      setMessage("A document can have at most 20 tags.");
      return;
    }
    void persist([...selectedTags.map(({ id }) => ({ id })), { id: tag.id }]);
  };
  const addInput = () => {
    if (!trimmed || saving.current || query.isPending || query.error) return;
    if (/\p{Cc}/u.test(trimmed)) {
      setMessage("Tag names cannot contain line breaks or control characters.");
      return;
    }
    if ([...trimmed].length > 50) {
      setMessage("Tag names can contain at most 50 characters.");
      return;
    }
    if (exact) return addExisting(exact);
    if (selectedTags.some((item) => item.name === trimmed)) {
      setMessage("This tag has already been added.");
      return;
    }
    if (selectedTags.length >= 20) {
      setMessage("A document can have at most 20 tags.");
      return;
    }
    void persist([...selectedTags.map(({ id }) => ({ id })), {
      name: trimmed,
    }]);
  };

  return (
    <Dialog.Root
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Document tags</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap="4">
                <Text color="fg.muted" fontSize="sm">
                  Add an existing tag or create a new case-sensitive tag.
                </Text>
                <TagPicker
                  collection={collection}
                  disabled={actions.pending || query.isPending || !!query.error}
                  emptyMessage="No tags available."
                  inputValue={input}
                  label="Tag name"
                  onInputSubmit={addInput}
                  onInputValueChange={(inputValue) => {
                    setInput(inputValue);
                    setMessage("");
                  }}
                  onRemove={(tag) =>
                    void persist(
                      selectedTags.filter(({ id }) => id !== tag.id)
                        .map(({ id }) => ({ id })),
                    )}
                  onSelect={(item) => {
                    if (item.tag) addExisting(item.tag);
                    else if (item.value === "create") addInput();
                  }}
                  placeholder="Search or create a tag"
                  portalled={false}
                  selectedTags={selectedTags}
                />
                {message && (
                  <Text color="fg.error" role="status">{message}</Text>
                )}
                {query.error && (
                  <Text color="fg.error">{String(query.error)}</Text>
                )}
              </Flex>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton aria-label="Close document tags" size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
