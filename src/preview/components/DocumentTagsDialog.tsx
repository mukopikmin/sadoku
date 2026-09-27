import {
  Button,
  Dialog,
  Flex,
  IconButton,
  Input,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TagReference } from "../api/tags";
import { useTagActions, useTagsQuery } from "../hooks/useTags";
import type { DocumentTag } from "../models/document";
import { findSimilarTags } from "../models/tagSuggestions";
import { TagLabel } from "./ui/TagLabel";

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
  const similar = useMemo(() => {
    const selectedIds = new Set(selectedTags.map(({ id }) => id));
    return findSimilarTags(
      input,
      allTags.filter(({ id }) => !selectedIds.has(id)),
    );
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
    if (!trimmed || saving.current) return;
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
                <Flex gap="2" wrap="wrap" aria-label="Selected tags">
                  {selectedTags.length === 0 && (
                    <Text color="fg.muted">No tags added.</Text>
                  )}
                  {selectedTags.map((tag, index) => (
                    <Button
                      key={`${tag.id}-${tag.name}-${index}`}
                      size="sm"
                      variant="outline"
                      disabled={actions.pending}
                      onClick={() =>
                        void persist(
                          selectedTags.filter((_, itemIndex) =>
                            itemIndex !== index
                          )
                            .map(({ id }) => ({ id })),
                        )}
                    >
                      <TagLabel
                        backgroundColor={tag.backgroundColor}
                        name={tag.name}
                      />{" "}
                      ×
                    </Button>
                  ))}
                </Flex>
                <Flex gap="2">
                  <Input
                    aria-label="Tag name"
                    disabled={actions.pending}
                    value={input}
                    onChange={(event) => {
                      setInput(event.currentTarget.value);
                      setMessage("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addInput();
                      }
                    }}
                    placeholder="Enter a tag name"
                  />
                  <Button
                    disabled={actions.pending || query.isPending || !trimmed ||
                      selectedTags.length >= 20}
                    onClick={addInput}
                  >
                    Add
                  </Button>
                </Flex>
                {message && (
                  <Text color="fg.error" role="status">{message}</Text>
                )}
                {trimmed && exact && !hasSelected(exact) && (
                  <Flex direction="column" gap="2">
                    <Text fontSize="sm" fontWeight="semibold">Exact match</Text>
                    <Button
                      alignSelf="flex-start"
                      size="sm"
                      variant="outline"
                      disabled={actions.pending || selectedTags.length >= 20}
                      onClick={() =>
                        addExisting(exact)}
                    >
                      <TagLabel
                        backgroundColor={exact.backgroundColor}
                        name={exact.name}
                      />
                    </Button>
                  </Flex>
                )}
                {trimmed && similar.length > 0 && (
                  <Flex direction="column" gap="2">
                    <Text fontSize="sm" fontWeight="semibold">
                      Similar tags
                    </Text>
                    <Flex gap="2" wrap="wrap">
                      {similar.map((tag) => (
                        <Button
                          key={tag.id}
                          size="sm"
                          variant="ghost"
                          disabled={actions.pending ||
                            selectedTags.length >= 20}
                          onClick={() => addExisting(tag)}
                        >
                          <TagLabel
                            backgroundColor={tag.backgroundColor}
                            name={tag.name}
                          />
                        </Button>
                      ))}
                    </Flex>
                    {!exact && (
                      <Text color="fg.muted" fontSize="sm">
                        You can still add “{trimmed}” as a new tag.
                      </Text>
                    )}
                  </Flex>
                )}
                {query.error && (
                  <Text color="fg.error">{String(query.error)}</Text>
                )}
              </Flex>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <IconButton
                aria-label="Close document tags"
                size="sm"
                variant="ghost"
              >
                ×
              </IconButton>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
