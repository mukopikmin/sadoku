import { CloseButton, Dialog, Flex, Portal, Text } from "@chakra-ui/react";
import type { RefObject } from "react";
import { InstructionsPanel } from "./InstructionsPanel";

type Props = {
  finalFocusRef?: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const GlobalInstructionsDialog = ({
  finalFocusRef,
  onOpenChange,
  open,
}: Props) => (
  <Dialog.Root
    finalFocusEl={() => finalFocusRef?.current ?? null}
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
            <Dialog.Title>Global instructions</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body pb="6" display="flex" minH="0" overflow="hidden">
            <Flex direction="column" gap="4" minH="0" flex="1">
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
