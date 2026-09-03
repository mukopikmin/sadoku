import {
  Button,
  Dialog,
  Field,
  Flex,
  Input,
  Portal,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTagsQuery, useUpdateTag } from "../hooks/usePreviewData";
import { TagLabel } from "./ui/TagLabel";

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const TagsDialog = ({ onOpenChange, open }: Props) => {
  const tags = useTagsQuery(open);
  const update = useUpdateTag();
  const [editingId, setEditingId] = useState<number>();
  const [name, setName] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#718096");
  const [message, setMessage] = useState("");

  const startEditing = (
    id: number,
    currentName: string,
    currentBackgroundColor: string,
  ) => {
    setEditingId(id);
    setName(currentName);
    setBackgroundColor(currentBackgroundColor);
    setMessage("");
  };
  const cancelEditing = () => {
    setEditingId(undefined);
    setMessage("");
  };
  const save = async () => {
    if (editingId === undefined) return;
    try {
      await update.mutateAsync({ id: editingId, name, backgroundColor });
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
                                <>
                                  <Input
                                    aria-label={`New name for ${tag.name}`}
                                    onChange={(event) =>
                                      setName(event.target.value)}
                                    size="sm"
                                    value={name}
                                  />

                                  <Field.Root mt="2">
                                    <Field.Label>Background color</Field.Label>
                                    <Flex align="center" gap="2">
                                      <Input
                                        aria-label={`Background color for ${tag.name}`}
                                        type="color"
                                        value={backgroundColor}
                                        onChange={(event) =>
                                          setBackgroundColor(
                                            event.target.value,
                                          )}
                                        size="sm"
                                      />
                                      <TagLabel
                                        backgroundColor={backgroundColor}
                                        name={name || tag.name}
                                      />
                                    </Flex>
                                  </Field.Root>
                                </>
                              )
                              : (
                                <TagLabel
                                  backgroundColor={tag.backgroundColor}
                                  name={tag.name}
                                />
                              )}
                          </Table.Cell>
                          <Table.Cell textAlign="end">
                            {tag.documentCount.toLocaleString()}
                          </Table.Cell>
                          <Table.Cell textAlign="end">
                            {editingId === tag.id
                              ? (
                                <Flex gap="2" justify="flex-end">
                                  <Button
                                    disabled={update.isPending}
                                    onClick={cancelEditing}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    loading={update.isPending}
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
                                  onClick={() =>
                                    startEditing(
                                      tag.id,
                                      tag.name,
                                      tag.backgroundColor,
                                    )}
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
