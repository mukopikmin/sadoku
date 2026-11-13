import {
  Box,
  Button,
  Flex,
  IconButton,
  Stack,
  Popover,
  Portal,
  useBreakpointValue,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { CodeXml, FilePenLine, Link, Plus, RotateCcw } from "lucide-react";
import { useContext, useMemo } from "react";
import { TableResizeControllerContext } from "../tableResizeControllerContext";
import type React from "react";
import { submitCommentOnShortcut } from "../../components/comments/commentShortcuts";
import { CommentItem } from "../../components/comments/CommentItem";
import { Tooltip } from "../../components/ui/tooltip";
import type { ActiveComment } from "../../models/comment";
import {
  MarkdownListDepthContext,
  markdownListIndentEm,
  markdownTopLevelListIndentEm,
} from "../markdownRenderers";
import { useCommentComposer } from "./useCommentComposer";
import type { CommentRange } from "./commentRanges";
import {
  type CommentControlProps,
  formatRangeLabel,
  SourceLineContext,
} from "./commentRendering";

export type CommentableBlockLayout = {
  blockProps: React.HTMLAttributes<HTMLElement> & {
    "data-source-line": number;
    "data-source-end-line": number;
  };
  content: (children: React.ReactNode) => React.ReactNode;
  anchor: (element: React.ReactElement) => React.ReactNode;
  thread: React.ReactNode;
  onContentClick: React.MouseEventHandler<HTMLElement>;
};

type CommentableBlockProps = CommentControlProps & {
  children: React.ReactNode;
  className?: string;
  comments: ActiveComment[];
  hasRangeHighlight: boolean;
  headingId?: string;
  isAdding: boolean;
  isRangeActionLine: boolean;
  isSelected: boolean;
  sourceRange: CommentRange;
  renderLayout?: (layout: CommentableBlockLayout) => React.ReactNode;
};

export const CommentableBlock = ({
  actions,
  activeRange,
  children,
  className,
  comments,
  hasRangeHighlight,
  headingId,
  isAdding,
  isRangeActionLine,
  isSelected,
  sourceRange,
  renderLayout,
  onCloseCommentForm,
  onOpenCommentForm,
  onOpenRawMarkdown,
  onSelectCommentRange,
  selectedRange,
}: CommentableBlockProps) => {
  const compact = useBreakpointValue(
    { base: true, md: false },
    { fallback: "md" },
  );
  const resize = useContext(TableResizeControllerContext);
  const composer = useCommentComposer({
    actions,
    sourceRange,
    activeRange,
    selectedRange,
    headingId,
    onCloseCommentForm,
    onSelectCommentRange,
  });
  const { state, pendingRange, textareaRef } = composer;
  const isSaving = state.status === "saving";
  const error = state.status === "error" ? state.message : undefined;
  const draft = state.draft;
  const ancestorSourceLines = useContext(SourceLineContext);
  const listDepth = useContext(MarkdownListDepthContext);
  const commentIndentEm =
    listDepth === 0
      ? 0
      : markdownTopLevelListIndentEm + (listDepth - 1) * markdownListIndentEm;
  const sourceLines = useMemo(() => {
    return new Set([...ancestorSourceLines, sourceRange.startLine]);
  }, [ancestorSourceLines, sourceRange.startLine]);

  const blockProps: CommentableBlockLayout["blockProps"] = {
    className: [
      "commentable-block",
      isSelected ? "commentable-block-selected" : undefined,
      isSelected ? "commentable-block-range-selected" : undefined,
      hasRangeHighlight ? "commentable-block-highlighted" : undefined,
      className,
    ]
      .filter(Boolean)
      .join(" "),
    "data-source-end-line": sourceRange.endLine,
    "data-source-line": sourceRange.startLine,
    style: {
      "--comment-indent-offset": `${commentIndentEm}em`,
    } as React.CSSProperties,
  };
  const content = (children: React.ReactNode) => (
    <SourceLineContext.Provider value={sourceLines}>
      {children}
    </SourceLineContext.Provider>
  );
  const gutter = isRangeActionLine && !isAdding && (
    <Flex
      className="comment-line-gutter"
      align="start"
      direction={compact ? "row" : "column"}
      wrap="wrap"
      gap="1"
      mb="0"
    >
      <Tooltip content={`Add comment on ${formatRangeLabel(pendingRange)}`}>
        <IconButton
          aria-label={`Add comment on ${formatRangeLabel(pendingRange)}`}
          bg="canvas"
          borderColor="accent"
          className="comment-line-button"
          color="accent"
          onClick={onOpenCommentForm}
          size="xs"
          type="button"
          variant="outline"
          _focusVisible={{ borderColor: "accent", color: "accent" }}
          _hover={{ borderColor: "accent", color: "accent" }}
        >
          <Plus aria-hidden="true" />
        </IconButton>
      </Tooltip>
      {resize && (
        <Tooltip content="Reset column widths">
          <IconButton
            aria-label="Reset column widths"
            size="xs"
            variant="outline"
            bg="canvas"
            borderColor="border"
            color="fg.muted"
            disabled={!resize.widths.some((width) => width > 0)}
            onClick={resize.reset}
            type="button"
          >
            <RotateCcw aria-hidden="true" />
          </IconButton>
        </Tooltip>
      )}
      {headingId && isSelected && (
        <Tooltip content="Update URL with heading link">
          <IconButton
            aria-label="Update URL with heading link"
            bg="canvas"
            borderColor="border"
            color="fg.muted"
            onClick={composer.setHeadingLink}
            size="xs"
            type="button"
            variant="outline"
          >
            <Link aria-hidden="true" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip
        content={`View raw Markdown for ${formatRangeLabel(pendingRange)}`}
      >
        <IconButton
          aria-label={`View raw Markdown for ${formatRangeLabel(pendingRange)}`}
          bg="canvas"
          borderColor="border"
          color="fg.muted"
          onClick={() => onOpenRawMarkdown(pendingRange)}
          size="xs"
          type="button"
          variant="outline"
        >
          <CodeXml aria-hidden="true" />
        </IconButton>
      </Tooltip>
    </Flex>
  );
  const thread = (isAdding || comments.length > 0 || error) && (
    <Stack className="comment-thread" gap="3">
      {comments.map((comment) => (
        <CommentItem
          actions={actions}
          comment={comment}
          key={comment.id}
          lineLabel={
            comment.startLine === comment.endLine
              ? `Line ${comment.startLine}`
              : `Lines ${comment.startLine}-${comment.endLine}`
          }
        />
      ))}
      {isAdding && (
        <Box
          borderLeftColor="accent"
          borderLeftWidth="3px"
          mb="1.5"
          pb="0.5"
          pl="3"
          pt="2"
        >
          <Flex align="center" justify="space-between" gap="2" mb="1">
            <Text color="fg.muted" fontSize="xs" fontWeight="semibold">
              Commenting on {formatRangeLabel(pendingRange)}.
            </Text>
            <Tooltip content="Suggest edit">
              <IconButton
                aria-label="Suggest edit"
                disabled={isSaving}
                onClick={composer.insertSuggestion}
                size="xs"
                type="button"
                variant="ghost"
              >
                <FilePenLine aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </Flex>
          <Textarea
            aria-label="Comment body"
            autoFocus
            fontSize="comment"
            minH="90px"
            onChange={(event) => composer.change(event.target.value)}
            onKeyDown={(event) =>
              submitCommentOnShortcut(event, () => {
                void composer.create();
              })
            }
            placeholder="Write a GitHub PR comment..."
            ref={textareaRef}
            value={draft}
          />
          <Flex wrap="wrap" gap="2">
            <Button
              size="xs"
              variant="outline"
              disabled={isSaving || draft.trim() === ""}
              onClick={composer.create}
              type="button"
            >
              Add comment
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={isSaving}
              onClick={onCloseCommentForm}
              type="button"
            >
              Cancel
            </Button>
          </Flex>
        </Box>
      )}
      {error && (
        <Text color="fg.error" fontSize="sm">
          {error}
        </Text>
      )}
    </Stack>
  );

  const anchor = (element: React.ReactElement) => (
    <Popover.Anchor asChild>{element}</Popover.Anchor>
  );
  const layout = renderLayout ? (
    renderLayout({
      blockProps,
      content,
      anchor,
      thread,
      onContentClick: composer.contentClick,
    })
  ) : (
    <Box {...blockProps}>
      {anchor(
        <Box className="commentable-content" onClick={composer.contentClick}>
          <Box className="comment-markdown-body">{content(children)}</Box>
        </Box>,
      )}
      {thread}
    </Box>
  );
  return (
    <Popover.Root
      open={Boolean(gutter)}
      autoFocus={false}
      closeOnInteractOutside={false}
      onOpenChange={({ open }) => {
        if (!open) onCloseCommentForm();
      }}
      positioning={{
        placement: compact ? "top-start" : "left-start",
        strategy: "fixed",
        flip: compact ? true : ["top-start", "bottom-start"],
        slide: true,
        // Keep actions reachable even when a code block is taller than the viewport.
        overlap: true,
        hideWhenDetached: true,
      }}
    >
      {layout}
      {gutter && (
        <Portal>
          <Popover.Positioner>
            <Popover.Content
              aria-label="Comment actions"
              width="auto"
              p={compact ? "2" : "0"}
            >
              {gutter}
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      )}
    </Popover.Root>
  );
};
