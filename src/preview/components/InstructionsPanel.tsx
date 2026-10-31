import { Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useInstructionEditor } from "../hooks/useInstructionEditor";
import {
  useInstructionActions,
  useInstructionsQuery,
} from "../hooks/useInstructions";
import type { InstructionScope } from "../models/instruction";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = { documentId: InstructionScope; open: boolean };
export const InstructionsPanel = ({ documentId, open }: Props) => {
  const query = useInstructionsQuery(documentId, open);
  const actions = useInstructionActions(documentId);
  const editor = useInstructionEditor(documentId, open);
  const [deletion, setDeletion] = useState<
    { id: number; error: string } | undefined
  >();
  useEffect(() => {
    setDeletion(undefined);
  }, [open, documentId]);
  const remove = async () => {
    if (!deletion || actions.pending) return;
    try {
      await actions.delete(deletion.id);
      if (
        editor.state.status === "editing" && editor.state.id === deletion.id
      ) {
        editor.cancel();
      }
      setDeletion(undefined);
    } catch (error) {
      setDeletion({
        ...deletion,
        error: error instanceof Error
          ? error.message
          : "Failed to delete instruction.",
      });
    }
  };
  const form = editor.state.status !== "closed" && (
    <>
      <Textarea
        aria-label="Instruction"
        autoFocus
        disabled={editor.pending}
        minH="32"
        onChange={(event) => editor.change(event.currentTarget.value)}
        placeholder={documentId === "global"
          ? "Add instructions for agents working with any document"
          : "Add information or instructions for agents working with this document"}
        value={editor.state.content}
      />
      {editor.state.error && (
        <Text color="fg.error" role="alert">
          {editor.state.error}
        </Text>
      )}
      <Flex gap="2" justifyContent="flex-end">
        <Button
          disabled={editor.pending}
          variant="ghost"
          onClick={editor.cancel}
        >
          Cancel
        </Button>
        <Button
          disabled={editor.pending || actions.pending ||
            !editor.state.content.trim()}
          onClick={() => void editor.save()}
        >
          Save instruction
        </Button>
      </Flex>
    </>
  );
  return (
    <>
      <Flex direction="column" gap="4">
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
              {editor.state.status === "editing" &&
                  editor.state.id === instruction.id
                ? form
                : (
                  <>
                    <Text whiteSpace="pre-wrap">{instruction.content}</Text>
                    <Flex gap="2" justifyContent="flex-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={editor.pending}
                        onClick={() => editor.edit(instruction)}
                      >
                        Edit
                      </Button>
                      <Button
                        colorPalette="red"
                        size="sm"
                        variant="ghost"
                        disabled={editor.pending || actions.pending}
                        onClick={() =>
                          setDeletion({ id: instruction.id, error: "" })}
                      >
                        Delete
                      </Button>
                    </Flex>
                  </>
                )}
            </Flex>
          ))}
        {editor.state.status === "closed"
          ? (
            <Button alignSelf="flex-end" onClick={editor.create}>
              Add Instruction
            </Button>
          )
          : editor.state.status === "creating" && form}
      </Flex>
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete instruction"
        isPending={actions.pending}
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setDeletion(undefined);
        }}
        open={open && deletion !== undefined}
        title="Delete instruction?"
      >
        {documentId === "global"
          ? "This global instruction will be permanently deleted for all documents."
          : "This instruction will be permanently deleted."}
        {deletion?.error && (
          <Text as="span" display="block" color="fg.error" role="alert">
            {deletion.error}
          </Text>
        )}
      </ConfirmDialog>
    </>
  );
};
