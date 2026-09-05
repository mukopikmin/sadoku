import {
  ActionBar,
  Button,
  Flex,
  HoverCard,
  Portal,
  Text,
} from "@chakra-ui/react";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import type { DocumentTag } from "../models/document";
import { TagLabel } from "./ui/TagLabel";

type DocumentActionBarProps = {
  markdown?: string;
  onOpenInstructions: () => void;
  onToggleHtmlComments: () => void;
  showHtmlComments: boolean;
  onOpenTags: () => void;
  tags: DocumentTag[];
};

export const DocumentActionBar = (
  {
    markdown,
    onOpenInstructions,
    onOpenTags,
    onToggleHtmlComments,
    showHtmlComments,
    tags,
  }: DocumentActionBarProps,
) => (
  <ActionBar.Root open>
    <Portal>
      <ActionBar.Positioner>
        <ActionBar.Content aria-label="Document actions">
          <HoverCard.Root
            closeDelay={100}
            openDelay={200}
            positioning={{ placement: "top-start" }}
            size="sm"
          >
            <HoverCard.Trigger asChild>
              <Button
                onClick={onOpenTags}
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
                    d="M2.5 3.5v3.3l6.7 6.7 4.3-4.3-6.7-6.7H3.5a1 1 0 0 0-1 1Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.3"
                  />
                  <circle cx="5.5" cy="5.5" fill="currentColor" r=".8" />
                </svg>
                Tags
              </Button>
            </HoverCard.Trigger>
            <Portal>
              <HoverCard.Positioner>
                <HoverCard.Content>
                  <HoverCard.Arrow>
                    <HoverCard.ArrowTip />
                  </HoverCard.Arrow>
                  <Text fontWeight="semibold">Document tags</Text>
                  {tags.length === 0
                    ? <Text color="fg.muted" pt="2">No tags added.</Text>
                    : (
                      <Flex gap="2" pt="2" wrap="wrap">
                        {tags.map((tag) => (
                          <TagLabel
                            backgroundColor={tag.backgroundColor}
                            key={tag.id}
                            name={tag.name}
                          />
                        ))}
                      </Flex>
                    )}
                </HoverCard.Content>
              </HoverCard.Positioner>
            </Portal>
          </HoverCard.Root>
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
            aria-label={showHtmlComments
              ? "Hide HTML comments"
              : "Show HTML comments"}
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
            HTML comments
          </Button>
          {markdown !== undefined && <TableOfContents markdown={markdown} />}
        </ActionBar.Content>
      </ActionBar.Positioner>
    </Portal>
  </ActionBar.Root>
);
