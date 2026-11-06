import { Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { useInstructionEditor } from "../hooks/useInstructionEditor";
import type { InstructionScope } from "../models/instruction";

import { ScrollableTextCard } from "./ui/ScrollableTextCard";

type Props = { documentId: InstructionScope; open: boolean };
export const InstructionsPanel = ({ documentId, open }: Props) => {
  const editor = useInstructionEditor(documentId, open);
  if (editor.query.isPending) return <Text>Loading instructions...</Text>;
  if (editor.query.error) {
    return (
      <Text color="fg.error" role="alert">
        {String(editor.query.error)}
      </Text>
    );
  }
  return (
    <Flex direction="column" gap="4" minH={editor.editing ? "56" : "0"}>
      {editor.editing ? (
        <Textarea
          aria-label="Instruction"
          autoFocus
          disabled={editor.pending}
          h="48"
          minH="24"
          maxH="36dvh"
          flexShrink="1"
          resize="none"
          onChange={(event) => editor.change(event.currentTarget.value)}
          placeholder={
            documentId === "global"
              ? "Instructions for agents working with any document"
              : "Instructions for agents working with this document"
          }
          value={editor.content}
        />
      ) : (
        <ScrollableTextCard label="Instruction text">
          <Text
            whiteSpace="pre-wrap"
            color={editor.content ? undefined : "fg.muted"}
          >
            {editor.content || "No instructions have been added."}
          </Text>
        </ScrollableTextCard>
      )}
      <Flex direction="column" gap="4" flexShrink="0">
        {editor.editing && (
          <Text color="fg.muted" fontSize="sm">
            Leave empty and save to clear the instructions.
          </Text>
        )}
        {editor.error && (
          <Text color="fg.error" role="alert">
            {editor.error}
          </Text>
        )}
        <Flex justify="flex-end" gap="3">
          {editor.editing ? (
            <>
              <Button
                variant="outline"
                disabled={editor.pending}
                onClick={editor.cancel}
              >
                Cancel
              </Button>
              <Button
                disabled={editor.pending || !editor.dirty}
                onClick={() => void editor.save()}
              >
                Save instruction
              </Button>
            </>
          ) : (
            <Button onClick={editor.startEditing}>Edit instructions</Button>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
};
