import { Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { useInstructionEditor } from "../hooks/useInstructionEditor";
import type { InstructionScope } from "../models/instruction";

type Props = { documentId: InstructionScope; open: boolean };
export const InstructionsPanel = ({ documentId, open }: Props) => {
  const editor = useInstructionEditor(documentId, open);
  const { state } = editor;
  if (state.status === "loading") return <Text>Loading instructions...</Text>;
  if (state.status === "load-error") {
    return (
      <Text color="fg.error" role="alert">
        {state.message}
      </Text>
    );
  }
  return (
    <Flex direction="column" gap="4">
      <Textarea
        aria-label="Instruction"
        disabled={state.status === "saving"}
        minH="48"
        onChange={(event) => editor.change(event.currentTarget.value)}
        placeholder={
          documentId === "global"
            ? "Instructions for agents working with any document"
            : "Instructions for agents working with this document"
        }
        value={state.content}
      />
      <Text color="fg.muted" fontSize="sm">
        Leave empty and save to clear the instructions.
      </Text>
      {state.status === "save-error" && (
        <Text color="fg.error" role="alert">
          {state.message}
        </Text>
      )}
      <Button
        alignSelf="flex-end"
        disabled={state.status === "saving" || !state.dirty}
        onClick={() => void editor.save()}
      >
        Save instruction
      </Button>
    </Flex>
  );
};
