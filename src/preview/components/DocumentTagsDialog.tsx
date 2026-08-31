import {
  Badge,
  Button,
  Dialog,
  Flex,
  IconButton,
  Input,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import type { TagReference, TagSummary } from "../api/tags";
import { useTagActions, useTagsQuery } from "../hooks/usePreviewData";
import type { DocumentTag } from "../models/document";
import { findSimilarTags } from "../models/tagSuggestions";

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
  const [selected, setSelected] = useState<TagReference[]>(
    tags.map(({ id }) => ({ id })),
  );
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (open) {
      setSelected(tags.map(({ id }) => ({ id })));
      setInput("");
      setMessage("");
    }
  }, [open, tags]);

  const allTags = query.data ?? [];
  const selectedTags = selected.map((reference) =>
    "id" in reference
      ? allTags.find(({ id }) => id === reference.id) ??
        tags.find(({ id }) => id === reference.id)
      : { id: -1, name: reference.name }
  ).filter((tag): tag is DocumentTag => tag !== undefined);
  const trimmed = input.trim();
  const exact = allTags.find(({ name }) => name === trimmed);
  const similar = useMemo(() => findSimilarTags(input, allTags), [
    input,
    allTags,
  ]);
  const hasSelected = (tag: DocumentTag) =>
    selected.some((item) => "id" in item && item.id === tag.id);

  const addExisting = (tag: DocumentTag) => {
    if (hasSelected(tag)) {
      setMessage("This tag has already been added.");
      return;
    }
    setSelected((current) => [...current, { id: tag.id }]);
    setInput("");
    setMessage("");
  };
  const addInput = () => {
    if (!trimmed) return;
    if (/\p{Cc}/u.test(trimmed)) {
      setMessage("Tag names cannot contain line breaks or control characters.");
      return;
    }
    if ([...trimmed].length > 50) {
      setMessage("Tag names can contain at most 50 characters.");
      return;
    }
    if (exact) return addExisting(exact);
    if (selected.some((item) => "name" in item && item.name === trimmed)) {
      setMessage("This tag has already been added.");
      return;
    }
    if (selected.length >= 20) {
      setMessage("A document can have at most 20 tags.");
      return;
    }
    setSelected((current) => [...current, { name: trimmed }]);
    setInput("");
    setMessage("");
  };
  const save = async () => {
    await actions.replace(selected);
    onOpenChange(false);
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
                      onClick={() =>
                        setSelected((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )}
                    >
                      {tag.name} ×
                    </Button>
                  ))}
                </Flex>
                <Flex gap="2">
                  <Input
                    aria-label="Tag name"
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
                    disabled={!trimmed || selected.length >= 20}
                    onClick={addInput}
                  >
                    Add
                  </Button>
                </Flex>
                {message && (
                  <Text color="fg.error" role="status">{message}</Text>
                )}
                {trimmed && exact && (
                  <Flex direction="column" gap="2">
                    <Text fontSize="sm" fontWeight="semibold">Exact match</Text>
                    <Button
                      alignSelf="flex-start"
                      size="sm"
                      variant="outline"
                      onClick={() => addExisting(exact)}
                    >
                      {exact.name}
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
                          onClick={() => addExisting(tag)}
                        >
                          {tag.name} <Badge ms="1">{tag.reason}</Badge>
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
                <Flex justifyContent="flex-end">
                  <Button
                    disabled={actions.pending || query.isPending}
                    onClick={() => void save()}
                  >
                    Save tags
                  </Button>
                </Flex>
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
