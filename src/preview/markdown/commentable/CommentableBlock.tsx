import {
  Box,
  Button,
  Flex,
  IconButton,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { CodeXml, FilePenLine, Link, Plus, RotateCcw } from "lucide-react";
import { useContext, useMemo } from "react";
import { TableLayoutContext } from "../tableLayoutContext";
import { TableResizeControllerContext } from "../tableResizeControllerContext";
import { useTableColumnResize } from "../useTableColumnResize";
import type { TableLayout } from "../../models/tableLayout";
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
};

export const CommentableBlock = (props: CommentableBlockProps) => {
  const layouts = useContext(TableLayoutContext);
  const ancestorController = useContext(TableResizeControllerContext);
  const layout =
    layouts?.state.status === "ready"
      ? layouts.state.tables.find(
          (table) => table.startLine === props.sourceRange.startLine,
        )
      : undefined;
  if (layout && layouts && ancestorController?.tableId !== layout.id) {
    return (
      <TableCommentableBlock {...props} layout={layout} save={layouts.save} />
    );
  }
  return <CommentableBlockContent {...props} />;
};

const TableCommentableBlock = ({
  layout,
  save,
  ...props
}: CommentableBlockProps & {
  layout: TableLayout;
  save: (id: string, widths: number[]) => Promise<TableLayout>;
}) => {
  const resize = useTableColumnResize(layout, save);
  return (
    <TableResizeControllerContext.Provider
      value={{ ...resize, tableId: layout.id }}
    >
      <CommentableBlockContent
        {...props}
        additionalActions={
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
        }
      />
    </TableResizeControllerContext.Provider>
  );
};

const CommentableBlockContent = ({
  actions,
  additionalActions,
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
  onCloseCommentForm,
  onOpenCommentForm,
  onOpenRawMarkdown,
  onSelectCommentRange,
  selectedRange,
}: CommentableBlockProps & { additionalActions?: React.ReactNode }) => {
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
  const commentGutterLeft =
    listDepth === 0
      ? "calc(-1 * var(--chakra-spacing-10))"
      : `calc(-1 * var(--chakra-spacing-10) - ${commentIndentEm}em)`;
  const sourceLines = useMemo(() => {
    return new Set([...ancestorSourceLines, sourceRange.startLine]);
  }, [ancestorSourceLines, sourceRange.startLine]);

  return (
    <Box
      className={[
        "commentable-block",
        isSelected ? "commentable-block-selected" : undefined,
        isSelected ? "commentable-block-range-selected" : undefined,
        hasRangeHighlight ? "commentable-block-highlighted" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-source-end-line={sourceRange.endLine}
      data-source-line={sourceRange.startLine}
      style={
        {
          "--comment-indent-offset": `${commentIndentEm}em`,
        } as React.CSSProperties
      }
    >
      <Box className="commentable-content" onClick={composer.contentClick}>
        {isRangeActionLine && !isAdding && (
          <Flex
            className="comment-line-gutter"
            align="start"
            direction={{ base: "row", md: "column" }}
            wrap="wrap"
            gap="1"
            left={commentGutterLeft}
            mb={{ base: "1.5", md: "0" }}
            position={{ base: "static", md: "absolute" }}
            top={{ md: "0.1rem" }}
          >
            <Tooltip
              content={`Add comment on ${formatRangeLabel(pendingRange)}`}
            >
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
            {additionalActions}
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
              content={`View raw Markdown for ${formatRangeLabel(
                pendingRange,
              )}`}
            >
              <IconButton
                aria-label={`View raw Markdown for ${formatRangeLabel(
                  pendingRange,
                )}`}
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
        )}
        <Box className="comment-markdown-body">
          <SourceLineContext.Provider value={sourceLines}>
            {children}
          </SourceLineContext.Provider>
        </Box>
      </Box>
      {(isAdding || comments.length > 0 || error) && (
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
      )}
    </Box>
  );
};
