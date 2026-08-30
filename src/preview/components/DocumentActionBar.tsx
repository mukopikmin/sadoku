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
            <svg
              aria-hidden="true"
              fill="none"
              height="1em"
              viewBox="0 0 16 16"
              width="1em"
            >
              <path
                d="M4 2.5h5l3 3v8H4v-11Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.3"
              />
              <path
                d="M9 2.5v3h3M6 8h4M6 10.5h4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.3"
              />
            </svg>
            Instructions
          </Button>
          {markdown !== undefined && <TableOfContents markdown={markdown} />}
        </ActionBar.Content>
      </ActionBar.Positioner>
    </Portal>
  </ActionBar.Root>
);
