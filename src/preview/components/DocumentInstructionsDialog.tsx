import {
  Button,
  CloseButton,
  Dialog,
  Flex,
  Portal,
  Text,
} from "@chakra-ui/react";
import { InstructionsPanel } from "./InstructionsPanel";

type Props = {
  documentId: number;
  onOpenChange: (open: boolean) => void;
  onOpenGlobalInstructions?: () => void;
  open: boolean;
};

export const DocumentInstructionsDialog = ({
  documentId,
  onOpenChange,
  onOpenGlobalInstructions,
  open,
}: Props) => {
  return (
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
              <Dialog.Title>Document instructions</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body display="flex" minH="0" overflow="hidden">
              <Flex direction="column" gap="4" minH="0" flex="1">
                <Text fontWeight="semibold">Global instructions</Text>
                <Text color="fg.muted" fontSize="sm">
                  Apply to all documents in this database. Document instructions
                  take precedence when they directly conflict.
                </Text>
                {onOpenGlobalInstructions && (
                  <Button
                    alignSelf="flex-start"
                    flexShrink="0"
                    variant="outline"
                    onClick={onOpenGlobalInstructions}
                  >
                    Manage global instructions
                  </Button>
                )}
                <Text fontWeight="semibold">This document</Text>
                <Text color="fg.muted" fontSize="sm">
                  Instructions and background information stored separately from
                  the Markdown document.
                </Text>
                <InstructionsPanel
                  scope={{ type: "document", documentId }}
                  open={open}
                />
              </Flex>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton aria-label="Close document instructions" size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
