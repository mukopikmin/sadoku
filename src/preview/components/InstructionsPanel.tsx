import { Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { useInstructionEditor } from "../hooks/useInstructionEditor";
import type { InstructionScope } from "../models/instruction";

import { ScrollableTextCard } from "./ui/ScrollableTextCard";

type Props = { scope: InstructionScope; open: boolean };
export const InstructionsPanel = ({ scope, open }: Props) => {
  const editor = useInstructionEditor(scope, open);
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
    <Flex
      direction="column"
      gap="4"
      maxH="48dvh"
      minH={editor.editing ? "56" : "0"}
    >
      <ScrollableTextCard
        label={editor.editing ? "Instruction editor" : "Instruction text"}
      >
        {editor.editing ? (
          <Textarea
            aria-label="Instruction"
            autoFocus
            disabled={state.status === "saving"}
            h="48"
            minH="24"
            maxH="36dvh"
            flexShrink="1"
            resize="none"
            onChange={(event) => editor.change(event.currentTarget.value)}
            placeholder={
              scope.type === "global"
                ? "Instructions for agents working with any document"
                : "Instructions for agents working with this document"
            }
            value={state.content}
          />
        ) : (
          <Text
            whiteSpace="pre-wrap"
            color={state.content ? undefined : "fg.muted"}
          >
            {state.content || "No instructions have been added."}
          </Text>
        )}
      </ScrollableTextCard>
      <Flex direction="column" alignItems="stretch" gap="4" flexShrink="0">
        {editor.editing && (
          <Text color="fg.muted" fontSize="sm">
            Leave empty and save to clear the instructions.
          </Text>
        )}
        {state.status === "save-error" && (
          <Text color="fg.error" role="alert">
            {state.message}
          </Text>
        )}
        <Flex justify="flex-end" gap="3">
          {editor.editing ? (
            <>
              <Button
                variant="outline"
                disabled={state.status === "saving"}
                onClick={editor.cancel}
              >
                Cancel
              </Button>
              <Button
                disabled={state.status === "saving" || !state.dirty}
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
