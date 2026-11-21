import {
  Button,
  CloseButton,
  Dialog,
  Flex,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useDocumentMemories } from "../hooks/useDocumentMemories";
import { ConfirmDialog } from "./ConfirmDialog";

import { ScrollableTextCard } from "./ui/ScrollableTextCard";

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
  const memories = useDocumentMemories(documentId, open);
  const { list, state } = memories;
  return (
    <>
      <Dialog.Root
        onOpenChange={({ open }) => onOpenChange(open)}
        open={open}
        placement="center"
        scrollBehavior="inside"
        size="lg"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="calc(100dvh - 2rem)">
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
                  {list.status === "loading" ? (
                    <Text>Loading memories...</Text>
                  ) : list.status === "error" ? (
                    <Text color="fg.error">{list.message}</Text>
                  ) : list.status === "empty" ? (
                    <Text color="fg.muted">No memories have been saved.</Text>
                  ) : (
                    list.items.map((memory) => (
                      <Flex
                        key={memory.id}
                        direction="column"
                        gap="2"
                        flexShrink="0"
                      >
                        <ScrollableTextCard label={`Memory ${memory.id} text`}>
                          <Text whiteSpace="pre-wrap">{memory.content}</Text>
                        </ScrollableTextCard>
                        <Flex
                          flexShrink="0"
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
                            variant="outline"
                            onClick={() => memories.requestDelete(memory)}
                          >
                            Delete
                          </Button>
                        </Flex>
                      </Flex>
                    ))
                  )}
                  {state.status === "error" && (
                    <Text color="fg.error">{state.message}</Text>
                  )}
                </Flex>
              </Dialog.Body>
              <Dialog.CloseTrigger asChild>
                <CloseButton aria-label="Close document memories" size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete memory"
        isPending={state.status === "deleting"}
        onConfirm={memories.remove}
        onOpenChange={(open) => {
          if (!open) memories.cancel();
        }}
        open={state.status !== "idle"}
        title="Delete memory?"
      >
        Agents will no longer receive this background information.
      </ConfirmDialog>
    </>
  );
};
