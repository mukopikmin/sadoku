import {
  Button,
  CloseButton,
  Dialog,
  Flex,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useInstructionsQuery } from "../hooks/useInstructions";
import { InstructionsPanel } from "./InstructionsPanel";

type Props = {
  documentId: number;
  onOpenChange: (open: boolean) => void;
  onOpenGlobalInstructions?: () => void;
  open: boolean;
};

export const DocumentInstructionsDialog = (
  { documentId, onOpenChange, onOpenGlobalInstructions, open }: Props,
) => {
  const globalQuery = useInstructionsQuery("global", open);
  return (
    <Dialog.Root
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
      scrollBehavior="inside"
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Document instructions</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap="4">
                <Text fontWeight="semibold">Global instructions</Text>
                <Text color="fg.muted" fontSize="sm">
                  Apply to all documents in this database. Document instructions
                  take precedence when they directly conflict.
                </Text>
                {globalQuery.isPending
                  ? <Text>Loading global instructions...</Text>
                  : globalQuery.error
                  ? (
                    <Text color="fg.error" role="alert">
                      {String(globalQuery.error)}
                    </Text>
                  )
                  : globalQuery.data?.length === 0
                  ? (
                    <Text color="fg.muted">
                      No global instructions have been added.
                    </Text>
                  )
                  : globalQuery.data?.map((instruction) => (
                    <Text key={instruction.id} whiteSpace="pre-wrap">
                      {instruction.content}
                    </Text>
                  ))}
                {onOpenGlobalInstructions && (
                  <Button
                    alignSelf="flex-start"
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
                <InstructionsPanel documentId={documentId} open={open} />
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
