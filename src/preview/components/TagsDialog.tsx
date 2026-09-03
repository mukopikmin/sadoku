import {
  Button,
  Dialog,
  Flex,
  Input,
  Portal,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { useRenameTag, useTagsQuery } from "../hooks/usePreviewData";

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const TagsDialog = ({ onOpenChange, open }: Props) => {
  const tags = useTagsQuery(open);
  const rename = useRenameTag();
  const [editingId, setEditingId] = useState<number>();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const startEditing = (id: number, currentName: string) => {
    setEditingId(id);
    setName(currentName);
    setMessage("");
  };
  const cancelEditing = () => {
    setEditingId(undefined);
    setMessage("");
  };
  const save = async () => {
    if (editingId === undefined) return;
    try {
      await rename.mutateAsync({ id: editingId, name });
      cancelEditing();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not rename tag.",
      );
    }
  };

  return (
    <Dialog.Root
      finalFocusEl={() =>
        document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open tags"]',
        )}
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Tags</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb="6">
              {tags.isPending
                ? <Spinner aria-label="Loading tags" />
                : tags.error
                ? <Text color="fg.error">{tags.error.message}</Text>
                : tags.data.length === 0
                ? <Text color="fg.muted">No tags yet.</Text>
                : (
                  <Table.Root>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Tag</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          Documents
                        </Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          Actions
                        </Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {tags.data.map((tag) => (
                        <Table.Row key={tag.id}>
                          <Table.Cell>
                            {editingId === tag.id
                              ? (
                                <Input
                                  aria-label={`New name for ${tag.name}`}
                                  onChange={(event) =>
                                    setName(event.target.value)}
                                  size="sm"
                                  value={name}
                                />
                              )
                              : tag.name}
                          </Table.Cell>
                          <Table.Cell textAlign="end">
                            {tag.documentCount.toLocaleString()}
                          </Table.Cell>
                          <Table.Cell textAlign="end">
                            {editingId === tag.id
                              ? (
                                <Flex gap="2" justify="flex-end">
                                  <Button
                                    disabled={rename.isPending}
                                    onClick={cancelEditing}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    loading={rename.isPending}
                                    onClick={save}
                                    size="sm"
                                  >
                                    Save
                                  </Button>
                                </Flex>
                              )
                              : (
                                <Button
                                  aria-label={`Rename tag ${tag.name}`}
                                  onClick={() => startEditing(tag.id, tag.name)}
                                  size="sm"
                                  variant="ghost"
                                >
                                  Rename
                                </Button>
                              )}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              {message && <Text color="fg.error" mt="3">{message}</Text>}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
