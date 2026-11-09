import {
  ActionBar,
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Portal,
  useElementRect,
} from "@chakra-ui/react";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import { useCallback } from "react";
import { Brain, FileDiff, FileText, History } from "lucide-react";
import type { useDocumentDiff } from "../hooks/useDocumentDiff";
import { Tooltip } from "./ui/tooltip";

type DocumentActionBarProps = {
  markdown: string;
  diff?: ReturnType<typeof useDocumentDiff>;
  memoryCount: number;
  onOpenInstructions: () => void;
  onOpenMemories: () => void;
  onOpenRevisions: () => void;
};

export const DocumentActionBar = ({
  markdown,
  diff,
  memoryCount,
  onOpenInstructions,
  onOpenMemories,
  onOpenRevisions,
}: DocumentActionBarProps) => {
  const { ref, rect } = useElementRect();
  const contentRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
    },
    [ref],
  );

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
            flexWrap="wrap"
            // The stable root scrollbar gutter already prevents shifts when dialogs open.
            translate="none"
          >
            <TableOfContents markdown={markdown} />
            {diff && (
              <Tooltip
                content={
                  diff.state.status !== "unavailable"
                    ? "Show changes since previous saved snapshot"
                    : "No previous comparison is available"
                }
              >
                <Box as="span" display="inline-flex">
                  <IconButton
                    aria-label="Changes since previous snapshot"
                    aria-description={
                      !(diff.state.status !== "unavailable")
                        ? "No previous comparison is available"
                        : undefined
                    }
                    aria-pressed={diff.state.status === "on"}
                    disabled={!(diff.state.status !== "unavailable")}
                    onClick={diff.onToggle}
                    size="sm"
                    variant={diff.state.status === "on" ? "solid" : "outline"}
                  >
                    <FileDiff aria-hidden="true" />
                  </IconButton>
                </Box>
              </Tooltip>
            )}
            <Flex alignItems="center" gap="3" wrap="wrap">
              <Tooltip content="Instructions">
                <IconButton
                  aria-label="Instructions"
                  onClick={onOpenInstructions}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <FileText aria-hidden="true" />
                </IconButton>
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
