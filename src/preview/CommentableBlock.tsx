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
import { submitCommentOnShortcut } from "./commentShortcuts";
import {
  type CommentControlProps,
  type CommentRange,
  formatRangeLabel,
  hasTextSelectionWithin,
  SourceLineContext,
} from "./commentRendering";
import { CommentItem } from "./CommentItem";
import type { PreviewComment } from "./comments";
import {
  MarkdownListDepthContext,
  markdownListIndentEm,
} from "./markdownRenderers";

type CommentableBlockProps = CommentControlProps & {
  children: React.ReactNode;
  className?: string;
  comments: PreviewComment[];
  hasCommentHighlight: boolean;
  isAdding: boolean;
  isRangeActionLine: boolean;
  isSelected: boolean;
  line: number;
};

export const CommentableBlock = ({
  activeRange,
  children,
  className,
  comments,
  hasCommentHighlight,
  isAdding,
  isRangeActionLine,
  isSelected,
  line,
  onCreateComment,
  onCloseCommentForm,
  onDeleteComment,
  onDeleteReply,
  onOpenCommentForm,
  onSelectCommentLine,
  onReplyComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
  selectedRange,
}: CommentableBlockProps) => {
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRange: CommentRange = activeRange ?? selectedRange ?? {
    endLine: line,
    startLine: line,
  };
  const [error, setError] = useState<string>();
  const ancestorSourceLines = useContext(SourceLineContext);
  const listDepth = useContext(MarkdownListDepthContext);
  const commentIndentEm = listDepth * markdownListIndentEm;
  const commentGutterLeft = listDepth === 0
    ? "-34px"
    : `calc(-34px - ${commentIndentEm}em)`;
  const sourceLines = useMemo(() => {
    return new Set([...ancestorSourceLines, line]);
  }, [ancestorSourceLines, line]);

  const handleCreate = async () => {
    const body = draft.trim();
    if (!body || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onCreateComment(pendingRange.startLine, body, pendingRange.endLine);
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

    onSelectCommentLine(line);
    event.stopPropagation();
  };

  return (
    <div
      className={[
        "commentable-block",
        isSelected || hasCommentHighlight
          ? "commentable-block-selected"
          : undefined,
        isSelected ? "commentable-block-range-selected" : undefined,
        hasCommentHighlight ? "commentable-block-comment-highlight" : undefined,
        className,
      ].filter(Boolean).join(" ")}
      data-source-line={line}
      style={{
        "--comment-indent-offset": `${commentIndentEm}em`,
      } as React.CSSProperties}
    >
      <div
        className="commentable-content"
        onClick={handleContentClick}
        title={`Select line ${line} for comment`}
      >
        {isRangeActionLine && !isAdding && (
          <Box
            className="comment-line-gutter"
            left={commentGutterLeft}
            mb={{ base: "1.5", md: "0" }}
            position={{ base: "static", md: "absolute" }}
            top={{ md: "0.1rem" }}
          >
            <IconButton
              aria-label={`Add comment on ${formatRangeLabel(pendingRange)}`}
              bg="canvas"
              borderColor="accent"
              boxSize="24px"
              className="comment-line-button"
              color="accent"
              fontSize="md"
              minW="24px"
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
          </Box>
        )}
        <div className="comment-markdown-body">
          <SourceLineContext.Provider value={sourceLines}>
            {children}
          </SourceLineContext.Provider>
        </div>
      </div>
      {(isAdding || comments.length > 0 || error) && (
        <div className="comment-thread">
          {comments.map((comment) => (
            <CommentItem
              comment={comment}
              key={comment.id}
              lineLabel={comment.startLine === comment.endLine
                ? `Line ${comment.startLine}`
                : `Lines ${comment.startLine}-${comment.endLine}`}
              onDeleteComment={onDeleteComment}
              onDeleteReply={onDeleteReply}
              onReplyComment={onReplyComment}
              onResolveComment={onResolveComment}
              onUpdateComment={onUpdateComment}
              onUpdateReply={onUpdateReply}
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
        </div>
      )}
    </div>
  );
};
