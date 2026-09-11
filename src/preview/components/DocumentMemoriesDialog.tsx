import {
  Button,
  Dialog,
  Flex,
  IconButton,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useDeleteMemory, useMemoriesQuery } from "../hooks/useMemories";
import type { DocumentMemory } from "../models/memory";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  documentId: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const DocumentMemoriesDialog = ({
  documentId,
  onOpenChange,
  open,
}: Props) => {
  const query = useMemoriesQuery(documentId, open);
  const deletion = useDeleteMemory(documentId);
  const [selected, setSelected] = useState<DocumentMemory>();
  useEffect(() => {
    if (!open) setSelected(undefined);
  }, [open]);
  const remove = async () => {
    if (!selected) return;
    try {
      await deletion.mutateAsync(selected.id);
      setSelected(undefined);
    } catch {
      // The mutation error is rendered below and the dialog remains open.
    }
  };
  return (
    <>
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
                <Dialog.Title>Document memories</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Flex direction="column" gap="4">
                  <Text color="fg.muted" fontSize="sm">
                    Background facts saved by agents for future work. You can
                    review or delete them here; use the Sadoku CLI to add or
                    update memories.
                  </Text>
                  {query.isPending
                    ? <Text>Loading memories...</Text>
                    : query.error
                    ? <Text color="fg.error">{String(query.error)}</Text>
                    : query.data?.length === 0
                    ? <Text color="fg.muted">No memories have been saved.</Text>
                    : (
                      query.data?.map((memory) => (
                        <Flex
                          key={memory.id}
                          borderWidth="1px"
                          borderColor="border.muted"
                          borderRadius="md"
                          direction="column"
                          gap="3"
                          p="3"
                        >
                          <Text whiteSpace="pre-wrap">{memory.content}</Text>
                          <Flex
                            alignItems="center"
                            gap="2"
                            justifyContent="space-between"
                          >
                            <Text
                              as="time"
                              color="fg.muted"
                              dateTime={memory.updatedAt}
                              fontSize="xs"
                            >
                              Updated{" "}
                              {new Date(memory.updatedAt).toLocaleString()}
                            </Text>
                            <Button
                              colorPalette="red"
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelected(memory)}
                            >
                              Delete
                            </Button>
                          </Flex>
                        </Flex>
                      ))
                    )}
                  {deletion.error && (
                    <Text color="fg.error">{String(deletion.error)}</Text>
                  )}
                </Flex>
              </Dialog.Body>
              <Dialog.CloseTrigger asChild>
                <IconButton
                  aria-label="Close document memories"
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
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete memory"
        isPending={deletion.isPending}
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
        open={selected !== undefined}
        title="Delete memory?"
      >
        Agents will no longer receive this background information.
      </ConfirmDialog>
    </>
  );
};
