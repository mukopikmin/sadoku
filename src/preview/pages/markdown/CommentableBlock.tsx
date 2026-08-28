import {
  Box,
  Button,
  Flex,
  IconButton,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useContext, useMemo, useState } from "react";
import type React from "react";
import { submitCommentOnShortcut } from "../../components/comments/commentShortcuts";
import {
  type CommentControlProps,
  type CommentRange,
  formatRangeLabel,
  hasTextSelectionWithin,
  SourceLineContext,
} from "./commentRendering";
import { CommentItem } from "../../components/comments/CommentItem";
import type { ActiveComment } from "../../models/comment";
import {
  MarkdownListDepthContext,
  markdownListIndentEm,
} from "../../markdown/markdownRenderers";

type CommentableBlockProps = CommentControlProps & {
  children: React.ReactNode;
  className?: string;
  comments: ActiveComment[];
  hasCommentHighlight: boolean;
  hasContinuousHighlight: boolean;
  headingId?: string;
  isAdding: boolean;
  isRangeActionLine: boolean;
  isSelected: boolean;
  sourceRange: CommentRange;
};

export const CommentableBlock = ({
  actions,
  activeRange,
  children,
  className,
  comments,
  hasCommentHighlight,
  hasContinuousHighlight,
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
}: CommentableBlockProps) => {
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRange: CommentRange = activeRange ?? selectedRange ?? {
    ...sourceRange,
  };
  const [error, setError] = useState<string>();
  const ancestorSourceLines = useContext(SourceLineContext);
  const listDepth = useContext(MarkdownListDepthContext);
  const commentIndentEm = listDepth * markdownListIndentEm;
  const commentGutterLeft = listDepth === 0
    ? "calc(-1 * var(--chakra-spacing-8))"
    : `calc(-1 * var(--chakra-spacing-8) - ${commentIndentEm}em)`;
  const sourceLines = useMemo(() => {
    return new Set([...ancestorSourceLines, sourceRange.startLine]);
  }, [ancestorSourceLines, sourceRange.startLine]);

  const handleCreate = async () => {
    const body = draft.trim();
    if (!body || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await actions.onCreateComment(
        pendingRange.startLine,
        body,
        pendingRange.endLine,
      );
      setDraft("");
      onCloseCommentForm();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, input, label, select, textarea")) return;
    if (hasTextSelectionWithin(event.currentTarget)) {
      event.stopPropagation();
      return;
    }

    const link = target.closest("a");
    if (link && !link.classList.contains("heading-anchor")) return;
    if (link) event.preventDefault();

    onSelectCommentRange(sourceRange, { extend: event.shiftKey });
    event.stopPropagation();
  };

  const handleSetHeadingLink = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!headingId) return;

    globalThis.location.hash = headingId;
  };

  return (
    <Box
      className={[
        "commentable-block",
        isSelected || hasCommentHighlight
          ? "commentable-block-selected"
          : undefined,
        isSelected ? "commentable-block-range-selected" : undefined,
        hasCommentHighlight ? "commentable-block-comment-highlight" : undefined,
        hasContinuousHighlight
          ? "commentable-block-continuous-highlight"
          : undefined,
        className,
      ].filter(Boolean).join(" ")}
      data-source-end-line={sourceRange.endLine}
      data-source-line={sourceRange.startLine}
      style={{
        "--comment-indent-offset": `${commentIndentEm}em`,
      } as React.CSSProperties}
    >
      <Box
        className="commentable-content"
        onClick={handleContentClick}
        title={`Select ${formatRangeLabel(sourceRange)} for comment`}
      >
        {isRangeActionLine && !isAdding && (
          <Flex
            className="comment-line-gutter"
            direction="column"
            gap="1"
            left={commentGutterLeft}
            mb={{ base: "1.5", md: "0" }}
            position={{ base: "static", md: "absolute" }}
            top={{ md: "0.1rem" }}
          >
            <IconButton
              aria-label={`Add comment on ${formatRangeLabel(pendingRange)}`}
              bg="canvas"
              borderColor="accent"
              boxSize="6"
              className="comment-line-button"
              color="accent"
              fontSize="md"
              minW="6"
              onClick={onOpenCommentForm}
              p="0"
              title={`Add comment on ${formatRangeLabel(pendingRange)}`}
              type="button"
              variant="outline"
              _focusVisible={{ borderColor: "accent", color: "accent" }}
              _hover={{ borderColor: "accent", color: "accent" }}
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="1em"
                viewBox="0 0 16 16"
                width="1em"
              >
                <path
                  d="M8 3.5v9M3.5 8h9"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
            </IconButton>
            {headingId && isSelected && (
              <IconButton
                aria-label="Update URL with heading link"
                bg="canvas"
                borderColor="border"
                boxSize="6"
                color="fg.muted"
                fontSize="xs"
                minW="6"
                onClick={handleSetHeadingLink}
                p="0"
                title="Update URL with heading link"
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
                    d="M6.5 9.5 9.5 6.5M5.25 11.75l-1 1a2.12 2.12 0 0 1-3-3l2.5-2.5a2.12 2.12 0 0 1 3 0M10.75 4.25l1-1a2.12 2.12 0 1 1 3 3l-2.5 2.5a2.12 2.12 0 0 1-3 0"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </IconButton>
            )}
            <IconButton
              aria-label={`View raw Markdown for ${
                formatRangeLabel(pendingRange)
              }`}
              bg="canvas"
              borderColor="border"
              boxSize="6"
              color="fg.muted"
              fontSize="xs"
              minW="6"
              onClick={() => onOpenRawMarkdown(pendingRange)}
              p="0"
              title={`View raw Markdown for ${formatRangeLabel(pendingRange)}`}
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
                  d="m5.5 4-4 4 4 4M10.5 4l4 4-4 4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </IconButton>
          </Flex>
        )}
        <Box className="comment-markdown-body">
          <SourceLineContext.Provider value={sourceLines}>
            {children}
          </SourceLineContext.Provider>
        </Box>
      </Box>
      {(isAdding || comments.length > 0 || error) && (
        <Box className="comment-thread">
          {comments.map((comment) => (
            <CommentItem
              actions={actions}
              comment={comment}
              key={comment.id}
              lineLabel={comment.startLine === comment.endLine
                ? `Line ${comment.startLine}`
                : `Lines ${comment.startLine}-${comment.endLine}`}
            />
          ))}
          {isAdding && (
            <Box mb="1.5">
              <Text color="fg.muted" fontSize="xs" fontWeight="semibold" mb="1">
                Commenting on {formatRangeLabel(pendingRange)}.
              </Text>
              <Textarea
                autoFocus
                minH="90px"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) =>
                  submitCommentOnShortcut(event, () => {
                    void handleCreate();
                  })}
                placeholder="Write a GitHub PR comment..."
                value={draft}
              />
              <Flex wrap="wrap" gap="2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isSaving || draft.trim() === ""}
                  onClick={handleCreate}
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
          {error && <Text color="red.500" fontSize="sm">{error}</Text>}
        </Box>
      )}
    </Box>
  );
};
