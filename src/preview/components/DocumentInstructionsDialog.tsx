import {
  Button,
  Dialog,
  Flex,
  IconButton,
  Portal,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  useInstructionActions,
  useInstructionsQuery,
} from "../hooks/usePreviewData";

type Props = {
  documentId: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const DocumentInstructionsDialog = (
  { documentId, onOpenChange, open }: Props,
) => {
  const query = useInstructionsQuery(documentId, open);
  const actions = useInstructionActions(documentId);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<number>();
  useEffect(() => {
    if (!open) {
      setContent("");
      setEditingId(undefined);
    }
  }, [open]);
  const save = async () => {
    if (editingId === undefined) await actions.create(content);
    else await actions.update({ id: editingId, content });
    setContent("");
    setEditingId(undefined);
  };
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
              <Dialog.Title>Document instructions</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap="4">
                <Text color="fg.muted" fontSize="sm">
                  Instructions and background information stored separately from
                  the Markdown document.
                </Text>
                {query.isPending
                  ? <Text>Loading instructions...</Text>
                  : query.error
                  ? <Text color="fg.error">{String(query.error)}</Text>
                  : query.data?.length === 0
                  ? (
                    <Text color="fg.muted">
                      No instructions have been added.
                    </Text>
                  )
                  : query.data?.map((instruction) => (
                    <Flex
                      key={instruction.id}
                      borderWidth="1px"
                      borderColor="border.muted"
                      borderRadius="md"
                      direction="column"
                      gap="3"
                      p="3"
                    >
                      <Text whiteSpace="pre-wrap">{instruction.content}</Text>
                      <Flex gap="2" justifyContent="flex-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(instruction.id);
                            setContent(instruction.content);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          colorPalette="red"
                          size="sm"
                          variant="ghost"
                          onClick={() => void actions.delete(instruction.id)}
                        >
                          Delete
                        </Button>
                      </Flex>
                    </Flex>
                  ))}
                <Textarea
                  aria-label="Instruction"
                  minH="32"
                  onChange={(event) => setContent(event.currentTarget.value)}
                  placeholder="Add information or instructions for agents working with this document"
                  value={content}
                />
                <Flex gap="2" justifyContent="flex-end">
                  {editingId !== undefined && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(undefined);
                        setContent("");
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                  <Button
                    disabled={actions.pending || content.trim().length === 0}
                    onClick={() => void save()}
                  >
                    {editingId === undefined
                      ? "Add instruction"
                      : "Save instruction"}
                  </Button>
                </Flex>
              </Flex>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <IconButton
                aria-label="Close document instructions"
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
  );
};
