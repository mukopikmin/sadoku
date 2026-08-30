import { ActionBar, Button, Portal } from "@chakra-ui/react";
import { TableOfContents } from "../pages/markdown/TableOfContents";

type DocumentActionBarProps = {
  markdown?: string;
  onOpenInstructions: () => void;
  onToggleHtmlComments: () => void;
  showHtmlComments: boolean;
};

export const DocumentActionBar = (
  {
    markdown,
    onOpenInstructions,
    onToggleHtmlComments,
    showHtmlComments,
  }: DocumentActionBarProps,
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
          <Button
            aria-pressed={!showHtmlComments}
            onClick={onToggleHtmlComments}
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
                d="M1.75 8s2.25-3.5 6.25-3.5S14.25 8 14.25 8 12 11.5 8 11.5 1.75 8 1.75 8Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.3"
              />
              <circle
                cx="8"
                cy="8"
                r="1.75"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              {!showHtmlComments && (
                <path
                  d="m2.5 2.5 11 11"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.3"
                />
              )}
            </svg>
            {showHtmlComments ? "Hide HTML comments" : "Show HTML comments"}
          </Button>
          {markdown !== undefined && <TableOfContents markdown={markdown} />}
        </ActionBar.Content>
      </ActionBar.Positioner>
    </Portal>
  </ActionBar.Root>
);
