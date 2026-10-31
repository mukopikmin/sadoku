import { Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { useInstructionEditor } from "../hooks/useInstructionEditor";
import type { InstructionScope } from "../models/instruction";

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
    <Flex direction="column" gap="4">
      <Textarea
        aria-label="Instruction"
        disabled={editor.pending}
        minH="48"
        onChange={(event) => editor.change(event.currentTarget.value)}
        placeholder={documentId === "global"
          ? "Instructions for agents working with any document"
          : "Instructions for agents working with this document"}
        value={editor.content}
      />
      <Text color="fg.muted" fontSize="sm">
        Leave empty and save to clear the instructions.
      </Text>
      {editor.error && (
        <Text color="fg.error" role="alert">
          {editor.error}
        </Text>
      )}
      <Button
        alignSelf="flex-end"
        disabled={editor.pending || !editor.dirty}
        onClick={() => void editor.save()}
      >
        Save instruction
      </Button>
    </Flex>
  );
};
