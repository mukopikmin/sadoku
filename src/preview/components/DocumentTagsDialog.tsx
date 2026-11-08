import {
  CloseButton,
  createListCollection,
  Dialog,
  Flex,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useMemo } from "react";
import { useDocumentTagEditor } from "../hooks/useDocumentTagEditor";
import type { DocumentTag } from "../models/document";
import { TagPicker } from "./ui/TagPicker";

type Props = {
  documentId: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tags: DocumentTag[];
};

export const DocumentTagsDialog = ({
  documentId,
  onOpenChange,
  open,
  tags,
}: Props) => {
  const editor = useDocumentTagEditor(documentId, open, tags);
  const { state, list } = editor;
  const collection = useMemo(
    () =>
      createListCollection({
        items: editor.options,
        itemToString: (item) => item.label,
        itemToValue: (item) => item.value,
        isItemDisabled: () => state.tags.length >= 20,
      }),
    [editor.options, state.tags.length],
  );

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
                  disabled={
                    state.status === "saving" ||
                    (list.status !== "ready" && list.status !== "empty")
                  }
                  emptyMessage="No tags available."
                  inputValue={state.input}
                  label="Tag name"
                  onInputSubmit={editor.submit}
                  onInputValueChange={editor.change}
                  onRemove={editor.remove}
                  onSelect={(item) => {
                    if (item.tag) editor.add(item.tag);
                    else if (item.value === "create") editor.submit();
                  }}
                  placeholder="Search or create a tag"
                  portalled={false}
                  selectedTags={state.tags}
                />
                {state.status === "error" && (
                  <Text color="fg.error" role="status">
                    {state.message}
                  </Text>
                )}
                {list.status === "error" && (
                  <Text color="fg.error">{list.message}</Text>
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
