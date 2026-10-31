import {
  ActionBar,
  Badge,
  Box,
  Button,
  Flex,
  HoverCard,
  IconButton,
  Portal,
  Text,
  useElementRect,
} from "@chakra-ui/react";
import { useCallback } from "react";
import { Brain, FileText, History, Tag } from "lucide-react";
import type { DocumentTag } from "../models/document";
import { TagLabel } from "./ui/TagLabel";
import { Tooltip } from "./ui/tooltip";

type DocumentActionBarProps = {
  instructionCount: number;
  memoryCount: number;
  onOpenInstructions: () => void;
  onOpenMemories: () => void;
  onOpenRevisions: () => void;
  tagCount: number;
  onOpenTags: () => void;
  tags: DocumentTag[];
};

export const DocumentActionBar = (
  {
    instructionCount,
    memoryCount,
    onOpenInstructions,
    onOpenMemories,
    onOpenRevisions,
    onOpenTags,
    tagCount,
    tags,
  }: DocumentActionBarProps,
) => {
  const { ref, rect } = useElementRect();
  const contentRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
  }, [ref]);

  return (
    <ActionBar.Root open>
      <Box
        aria-hidden="true"
        data-testid="action-bar-spacer"
        h={`${rect?.height ?? 0}px`}
        mb="env(safe-area-inset-bottom, 0px)"
      />
      <Portal>
        <ActionBar.Positioner>
          <ActionBar.Content
            ref={contentRef}
            aria-label="Document actions"
            maxW="calc(100vw - 2rem)"
          >
            <Flex alignItems="center" gap="3" wrap="wrap">
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
              <Tooltip content="Revisions">
                <IconButton
                  aria-label="Revisions"
                  onClick={onOpenRevisions}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <History aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </Flex>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
};
