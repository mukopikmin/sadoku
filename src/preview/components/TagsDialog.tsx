import {
  Button,
  CloseButton,
  ColorPicker,
  ColorSwatch,
  Dialog,
  Flex,
  IconButton,
  Input,
  parseColor,
  Portal,
  Spinner,
  Table,
  Text,
  useToken,
} from "@chakra-ui/react";
import { Pencil, Trash2 } from "lucide-react";
import { type RefObject } from "react";
import { useTagsManager } from "../hooks/useTagsManager";
import { ConfirmDialog } from "./ConfirmDialog";
import { TagLabel } from "./ui/TagLabel";

type Props = {
  finalFocusRef?: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const TagsDialog = ({ finalFocusRef, onOpenChange, open }: Props) => {
  const swatchColors = useToken("colors", [
    "gray.500",
    "blue.500",
    "green.500",
  ]);
  const manager = useTagsManager(open);
  const { state, list, selectedTag } = manager;
  const input = "input" in state ? state.input : undefined;
  const editingId = input?.id;
  const deletingId = "id" in state ? state.id : undefined;
  const pending = state.status === "saving" || state.status === "deleting";

  return (
    <>
      <Dialog.Root
        finalFocusEl={() => finalFocusRef?.current ?? null}
        onOpenChange={({ open }) => onOpenChange(open)}
        open={open}
        size="lg"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Tags</Dialog.Title>
              </Dialog.Header>
              <Dialog.CloseTrigger asChild>
                <CloseButton aria-label="Close tags" size="sm" />
              </Dialog.CloseTrigger>
              <Dialog.Body pb="6">
                {list.status === "loading" ? (
                  <Spinner aria-label="Loading tags" />
                ) : list.status === "error" ? (
                  <Text color="fg.error">{list.message}</Text>
                ) : list.status === "empty" ? (
                  <Text color="fg.muted">No tags yet.</Text>
                ) : (
                  <Table.Root>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Tag</Table.ColumnHeader>
                        <Table.ColumnHeader>Color</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          Documents
                        </Table.ColumnHeader>
                        <Table.ColumnHeader />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {list.items.map((tag) => (
                        <Table.Row key={tag.id}>
                          <Table.Cell>
                            {editingId === tag.id ? (
                              <Input
                                aria-label={`New name for ${tag.name}`}
                                onChange={(event) =>
                                  manager.change({ name: event.target.value })
                                }
                                size="sm"
                                value={input?.name ?? ""}
                              />
                            ) : (
                              <TagLabel
                                backgroundColor={tag.backgroundColor}
                                name={tag.name}
                              />
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            {editingId === tag.id ? (
                              <ColorPicker.Root
                                format="rgba"
                                onValueChange={({ value }) =>
                                  manager.change({
                                    backgroundColor: value
                                      .toString("hex")
                                      .toLowerCase(),
                                  })
                                }
                                size="sm"
                                value={parseColor(
                                  input?.backgroundColor ?? swatchColors[0],
                                )}
                              >
                                <ColorPicker.Label srOnly>
                                  Background color
                                </ColorPicker.Label>
                                <ColorPicker.Control>
                                  <ColorPicker.Input
                                    aria-label={`Background color for ${tag.name}`}
                                  />
                                  <ColorPicker.Trigger>
                                    <ColorPicker.ValueSwatch />
                                  </ColorPicker.Trigger>
                                </ColorPicker.Control>
                                <ColorPicker.Positioner>
                                  <ColorPicker.Content>
                                    <ColorPicker.Area>
                                      <ColorPicker.AreaBackground />
                                      <ColorPicker.AreaThumb />
                                    </ColorPicker.Area>
                                    <ColorPicker.Sliders>
                                      <ColorPicker.ChannelSlider channel="hue">
                                        <ColorPicker.ChannelSliderTrack />
                                        <ColorPicker.ChannelSliderThumb />
                                      </ColorPicker.ChannelSlider>
                                    </ColorPicker.Sliders>
                                    <ColorPicker.SwatchGroup>
                                      {swatchColors.map((color) => (
                                        <ColorPicker.SwatchTrigger
                                          aria-label={`Select ${color}`}
                                          key={color}
                                          value={color}
                                        >
                                          <ColorPicker.Swatch value={color} />
                                        </ColorPicker.SwatchTrigger>
                                      ))}
                                    </ColorPicker.SwatchGroup>
                                  </ColorPicker.Content>
                                </ColorPicker.Positioner>
                              </ColorPicker.Root>
                            ) : (
                              <Flex align="center" gap="2">
                                <ColorSwatch
                                  value={tag.backgroundColor}
                                  size="sm"
                                />
                                <Text fontSize="sm">{tag.backgroundColor}</Text>
                              </Flex>
                            )}
                          </Table.Cell>
                          <Table.Cell textAlign="end">
                            {tag.documentCount.toLocaleString()}
                          </Table.Cell>
                          <Table.Cell textAlign="end">
                            {editingId === tag.id ? (
                              <Flex gap="2" justify="flex-end">
                                <Button
                                  disabled={state.status === "saving"}
                                  onClick={manager.cancel}
                                  size="sm"
                                  variant="ghost"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  loading={state.status === "saving"}
                                  onClick={manager.save}
                                  size="sm"
                                >
                                  Save
                                </Button>
                              </Flex>
                            ) : (
                              <Flex gap="2" justify="flex-end">
                                <IconButton
                                  disabled={pending}
                                  aria-label={`Edit tag ${tag.name}`}
                                  onClick={() =>
                                    manager.edit({
                                      id: tag.id,
                                      name: tag.name,
                                      backgroundColor: tag.backgroundColor,
                                    })
                                  }
                                  size="sm"
                                  variant="ghost"
                                >
                                  <Pencil aria-hidden="true" />
                                </IconButton>
                                <IconButton
                                  aria-label={`Delete tag ${tag.name}`}
                                  colorPalette="red"
                                  disabled={pending}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    manager.requestDelete(tag.id);
                                  }}
                                >
                                  <Trash2 aria-hidden="true" />
                                </IconButton>
                              </Flex>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
                {state.status === "edit-error" && (
                  <Text color="fg.error" mt="3">
                    {state.message}
                  </Text>
                )}
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete"
        isPending={state.status === "deleting"}
        onConfirm={manager.deleteSelected}
        onOpenChange={(open) => {
          if (!open) manager.cancel();
        }}
        open={open && deletingId !== undefined}
        title="Delete tag?"
      >
        Delete {selectedTag?.name}? This removes the tag from all documents.
        Documents will be kept.
        {state.status === "delete-error" && (
          <Text as="span" display="block" color="fg.error" role="alert">
            {state.message}
          </Text>
        )}
      </ConfirmDialog>
    </>
  );
};
