import { CloseButton, Dialog, Flex, Portal, Text } from "@chakra-ui/react";
import type { RefObject } from "react";
import { InstructionsPanel } from "./InstructionsPanel";

type Props = {
  finalFocusRef?: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const GlobalInstructionsDialog = (
  { finalFocusRef, onOpenChange, open }: Props,
) => (
  <Dialog.Root
    finalFocusEl={() => finalFocusRef?.current ?? null}
    onOpenChange={({ open }) => onOpenChange(open)}
    open={open}
    scrollBehavior="inside"
    size="xl"
  >
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Global instructions</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body pb="6">
            <Flex direction="column" gap="4">
              <Text color="fg.muted" fontSize="sm">
                These instructions apply to all documents in this database.
                Changes affect every document. Document instructions take
                precedence when they directly conflict.
              </Text>
              <InstructionsPanel documentId="global" open={open} />
            </Flex>
          </Dialog.Body>
          <Dialog.CloseTrigger asChild>
            <CloseButton aria-label="Close global instructions" size="sm" />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);
