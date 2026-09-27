import {
  ActionBar,
  Badge,
  Button,
  Flex,
  HoverCard,
  IconButton,
  Portal,
  Text,
} from "@chakra-ui/react";
import { Brain, Eye, EyeOff, FileText, Tag } from "lucide-react";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import type { DocumentTag } from "../models/document";
import { TagLabel } from "./ui/TagLabel";
import { Tooltip } from "./ui/tooltip";

type DocumentActionBarProps = {
  instructionCount: number;
  memoryCount: number;
  markdown?: string;
  onOpenInstructions: () => void;
  onOpenMemories: () => void;
  onToggleHtmlComments: () => void;
  showHtmlComments: boolean;
  tagCount: number;
  onOpenTags: () => void;
  tags: DocumentTag[];
};

export const DocumentActionBar = (
  {
    instructionCount,
    memoryCount,
    markdown,
    onOpenInstructions,
    onOpenMemories,
    onOpenTags,
    onToggleHtmlComments,
    showHtmlComments,
    tagCount,
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
            <Tooltip content="Tags">
              <HoverCard.Trigger asChild>
                <Button
                  aria-label="Tags"
                  onClick={onOpenTags}
                  px={tagCount === 0 ? "0" : undefined}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Tag aria-hidden="true" />
                  {tagCount > 0 && (
                    <Badge aria-hidden="true" size="sm" variant="solid">
                      {tagCount}
                    </Badge>
                  )}
                </Button>
              </HoverCard.Trigger>
            </Tooltip>
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
          <Tooltip content="Instructions">
            <Button
              aria-label="Instructions"
              onClick={onOpenInstructions}
              px={instructionCount === 0 ? "0" : undefined}
              size="sm"
              type="button"
              variant="outline"
            >
              <FileText aria-hidden="true" />
              {instructionCount > 0 && (
                <Badge aria-hidden="true" size="sm" variant="solid">
                  {instructionCount}
                </Badge>
              )}
            </Button>
          </Tooltip>
          <Tooltip content="Memories">
            <Button
              aria-label="Memories"
              onClick={onOpenMemories}
              px={memoryCount === 0 ? "0" : undefined}
              size="sm"
              type="button"
              variant="outline"
            >
              <Brain aria-hidden="true" />
              {memoryCount > 0 && (
                <Badge aria-hidden="true" size="sm" variant="solid">
                  {memoryCount}
                </Badge>
              )}
            </Button>
          </Tooltip>
          <Tooltip
            content={showHtmlComments
              ? "Hide HTML comments"
              : "Show HTML comments"}
          >
            <IconButton
              aria-label={showHtmlComments
                ? "Hide HTML comments"
                : "Show HTML comments"}
              aria-pressed={!showHtmlComments}
              onClick={onToggleHtmlComments}
              size="sm"
              type="button"
              variant="outline"
            >
              {showHtmlComments
                ? <Eye aria-hidden="true" />
                : <EyeOff aria-hidden="true" />}
            </IconButton>
          </Tooltip>
          {markdown !== undefined && <TableOfContents markdown={markdown} />}
        </ActionBar.Content>
      </ActionBar.Positioner>
    </Portal>
  </ActionBar.Root>
);
