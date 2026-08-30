import { ActionBar, Button, Portal } from "@chakra-ui/react";
import { TableOfContents } from "../pages/markdown/TableOfContents";

type DocumentActionBarProps = {
  markdown?: string;
  onOpenInstructions: () => void;
};

export const DocumentActionBar = (
  { markdown, onOpenInstructions }: DocumentActionBarProps,
) => (
  <ActionBar.Root open>
    <Portal>
      <ActionBar.Positioner>
        <ActionBar.Content aria-label="Document actions">
          <Button
            onClick={onOpenInstructions}
            size="sm"
            type="button"
            variant="outline"
          >
            Instructions
          </Button>
          {markdown !== undefined && <TableOfContents markdown={markdown} />}
        </ActionBar.Content>
      </ActionBar.Positioner>
    </Portal>
  </ActionBar.Root>
);
