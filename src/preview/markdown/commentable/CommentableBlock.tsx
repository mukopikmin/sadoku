import {
  Box,
  Button,
  Flex,
  IconButton,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { CodeXml, Link, Plus } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import type React from "react";
import { submitCommentOnShortcut } from "../../components/comments/commentShortcuts";
import { CommentItem } from "../../components/comments/CommentItem";
import { Tooltip } from "../../components/ui/tooltip";
import type { ActiveComment } from "../../models/comment";
import {
  MarkdownListDepthContext,
  markdownListIndentEm,
} from "../markdownRenderers";
import type { CommentRange } from "./commentRanges";
import {
  type CommentControlProps,
  formatRangeLabel,
  hasTextSelectionWithin,
  SourceLineContext,
  useCommentRenderingContext,
} from "./commentRendering";

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

const suggestionBody = (replacement: string): string => {
  const longestBacktickRun = Math.max(
    0,
    ...[...replacement.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}suggestion\n${replacement}\n${fence}`;
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
  const [draft, setDraft] = useState<
    { body: string; type: "comment" | "suggestion" }
  >({ body: "", type: "comment" });
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

  const { markdown } = useCommentRenderingContext();
  const selectedSource = useMemo(() =>
    markdown.split(/\r?\n/).slice(
      pendingRange.startLine - 1,
      pendingRange.endLine,
    ).join("\n"), [markdown, pendingRange.endLine, pendingRange.startLine]);

  const handleCreate = async () => {
    const content = draft.type === "suggestion"
      ? draft.body
      : draft.body.trim();
    const body = draft.type === "suggestion"
      ? suggestionBody(content)
      : content;
    if (!content.trim() || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await actions.onCreateComment(
        pendingRange.startLine,
        body,
        pendingRange.endLine,
      );
      setDraft({ body: "", type: "comment" });
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
    // On Windows, Shift+click can extend the browser's native text selection
    // before the click event reaches us. It must still extend the comment range.
    if (!event.shiftKey && hasTextSelectionWithin(event.currentTarget)) {
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
            <Tooltip
              content={`Add comment on ${formatRangeLabel(pendingRange)}`}
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
                type="button"
                variant="outline"
                _focusVisible={{ borderColor: "accent", color: "accent" }}
                _hover={{ borderColor: "accent", color: "accent" }}
              >
                <Plus aria-hidden="true" />
              </IconButton>
            </Tooltip>
            {headingId && isSelected && (
              <Tooltip content="Update URL with heading link">
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
                  type="button"
                  variant="outline"
                >
                  <Link aria-hidden="true" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip
              content={`View raw Markdown for ${
                formatRangeLabel(pendingRange)
              }`}
            >
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
              <Flex gap="2" mb="2" role="group" aria-label="Comment type">
                <Button
                  aria-pressed={draft.type === "comment"}
                  onClick={() => setDraft({ body: "", type: "comment" })}
                  size="xs"
                  type="button"
                  variant={draft.type === "comment" ? "solid" : "outline"}
                >
                  Comment
                </Button>
                <Button
                  aria-pressed={draft.type === "suggestion"}
                  onClick={() =>
                    setDraft({ body: selectedSource, type: "suggestion" })}
                  size="xs"
                  type="button"
                  variant={draft.type === "suggestion" ? "solid" : "outline"}
                >
                  Suggest edit
                </Button>
              </Flex>
              <Textarea
                aria-label={draft.type === "suggestion"
                  ? "Suggested replacement"
                  : "Comment body"}
                autoFocus
                minH="90px"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    body: event.target.value,
                  }))}
                onKeyDown={(event) =>
                  submitCommentOnShortcut(event, () => {
                    void handleCreate();
                  })}
                placeholder={draft.type === "suggestion"
                  ? "Edit the suggested replacement..."
                  : "Write a GitHub PR comment..."}
                value={draft.body}
              />
              <Flex wrap="wrap" gap="2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isSaving || draft.body.trim() === ""}
                  onClick={handleCreate}
                  type="button"
                >
                  {draft.type === "suggestion"
                    ? "Add suggestion"
                    : "Add comment"}
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
