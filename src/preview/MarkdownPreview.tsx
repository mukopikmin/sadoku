import {
  Box,
  Button,
  Flex,
  IconButton,
  List,
  Separator,
  Text,
  Textarea,
} from "@chakra-ui/react";
import {
  Children,
  createContext,
  createElement,
  isValidElement,
  useContext,
  useMemo,
  useState,
} from "react";
import type React from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { submitCommentOnShortcut } from "./commentShortcuts";
import { CommentItem } from "./CommentItem";
import type { PreviewComment } from "./comments";

export type MarkdownPreviewProps = {
  comments: PreviewComment[];
  markdown: string;
  onCreateComment: (
    startLine: number,
    body: string,
    endLine: number,
  ) => Promise<void>;
  onDeleteComment: (id: number) => Promise<void>;
  onDeleteReply: (commentId: number, replyId: number) => Promise<void>;
  onReplyComment: (id: number, body: string) => Promise<void>;
  onResolveComment: (id: number) => Promise<void>;
  onUpdateComment: (id: number, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: number,
    replyId: number,
    body: string,
  ) => Promise<void>;
};

const trimFinalNewline = (value: string): string => value.replace(/\n$/, "");

const SourceLineContext = createContext<ReadonlySet<number>>(new Set());
const ListDepthContext = createContext(0);
const CodeBlockContext = createContext(false);
const listIndentEm = 2.5;

type SourcePosition = {
  start?: {
    line?: number;
  };
};

type SourceNode = {
  position?: SourcePosition;
};

type CommentableBlockProps = {
  activeRange?: CommentRange;
  children: React.ReactNode;
  className?: string;
  comments: PreviewComment[];
  hasCommentHighlight: boolean;
  isAdding: boolean;
  isRangeActionLine: boolean;
  isSelected: boolean;
  line: number;
  onCreateComment: (
    startLine: number,
    body: string,
    endLine: number,
  ) => Promise<void>;
  onCloseCommentForm: () => void;
  onDeleteComment: (id: number) => Promise<void>;
  onDeleteReply: (commentId: number, replyId: number) => Promise<void>;
  onOpenCommentForm: () => void;
  onSelectCommentLine: (line: number) => void;
  onReplyComment: (id: number, body: string) => Promise<void>;
  onResolveComment: (id: number) => Promise<void>;
  onUpdateComment: (id: number, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: number,
    replyId: number,
    body: string,
  ) => Promise<void>;
  selectedRange?: CommentRange;
};

const getSourceLine = (props: { node?: SourceNode }): number | undefined => {
  return props.node?.position?.start?.line;
};

type CommentRange = { endLine: number; startLine: number };

const isLineInRange = (line: number, range: CommentRange): boolean =>
  line >= range.startLine && line <= range.endLine;

const formatRangeLabel = (range: CommentRange): string =>
  range.startLine === range.endLine
    ? `line ${range.startLine}`
    : `lines ${range.startLine}-${range.endLine}`;

const hasTextSelectionWithin = (element: Element): boolean => {
  const selection = element.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed) return false;

  return element.contains(selection.anchorNode) ||
    element.contains(selection.focusNode);
};

const CommentableBlock = ({
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
  const pendingRange = activeRange ?? selectedRange ?? {
    endLine: line,
    startLine: line,
  };
  const [error, setError] = useState<string>();
  const ancestorSourceLines = useContext(SourceLineContext);
  const listDepth = useContext(ListDepthContext);
  const commentGutterLeft = listDepth === 0
    ? "-34px"
    : `calc(-34px - ${listDepth * listIndentEm}em)`;
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
              _focusVisible={{
                borderColor: "accent",
                color: "accent",
              }}
              _hover={{
                borderColor: "accent",
                color: "accent",
              }}
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
                  onClick={() => {
                    onCloseCommentForm();
                  }}
                  type="button"
                >
                  Cancel
                </Button>
              </Flex>
            </Box>
          )}
          {error && (
            <Text color="red.500" fontSize="sm">
              {error}
            </Text>
          )}
        </div>
      )}
    </div>
  );
};

type ComponentProps = {
  children?: React.ReactNode;
  className?: string;
  node?: SourceNode;
};

const mergeClassNames = (
  ...classNames: Array<string | undefined>
): string | undefined => {
  const merged = classNames.filter(Boolean).join(" ");
  return merged === "" ? undefined : merged;
};

const headingSizes = {
  h1: "2rem",
  h2: "1.5rem",
  h3: "1.25rem",
  h4: "1rem",
  h5: "0.875rem",
  h6: "0.85rem",
} as const;

const renderHeading = (
  tagName: keyof typeof headingSizes,
  elementProps: Omit<ComponentProps, "children" | "node">,
  children: React.ReactNode,
) => (
  <Box
    as={tagName}
    borderBottomWidth={tagName === "h1" || tagName === "h2" ? "1px" : "0"}
    borderColor="border.muted"
    color={tagName === "h6" ? "fg.muted" : undefined}
    fontSize={headingSizes[tagName]}
    fontWeight="semibold"
    lineHeight="1.25"
    mt="6"
    mb="4"
    pb={tagName === "h1" || tagName === "h2" ? "0.3em" : "0"}
    {...elementProps}
  >
    {children}
  </Box>
);

const isListElement = (
  child: React.ReactNode,
): child is React.ReactElement =>
  isValidElement(child) &&
  (child.type === "ol" || child.type === "ul" ||
    child.props.node?.tagName === "ol" || child.props.node?.tagName === "ul");

const splitListItemChildren = (
  children: React.ReactNode,
): { itemChildren: React.ReactNode[]; nestedLists: React.ReactNode[] } => {
  const itemChildren: React.ReactNode[] = [];
  const nestedLists: React.ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (isListElement(child)) {
      nestedLists.push(child);
    } else {
      itemChildren.push(child);
    }
  }
  return { itemChildren, nestedLists };
};

type CodeElementProps = {
  children?: React.ReactNode;
  className?: string;
};

const getMermaidCodeText = (
  children: React.ReactNode,
): string | undefined => {
  const childElements = Children.toArray(children);
  if (childElements.length !== 1) return undefined;
  const child = childElements[0];
  if (!isValidElement<CodeElementProps>(child)) return undefined;
  const className = child.props.className;
  if (!className?.match(/\blanguage-mermaid\b/)) return undefined;

  return trimFinalNewline(String(child.props.children));
};

type CommentControlProps =
  & Pick<
    MarkdownPreviewProps,
    | "onCreateComment"
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
  >
  & {
    activeCommentLine?: number;
    activeRange?: CommentRange;
    onCloseCommentForm: () => void;
    onOpenCommentForm: () => void;
    onSelectCommentLine: (line: number) => void;
    selectedRange?: CommentRange;
  };

type CommentRenderingContextValue = CommentControlProps & {
  commentsByLine: Map<number, PreviewComment[]>;
  commentHighlightsByLine: Set<number>;
};

const CommentRenderingContext = createContext<
  CommentRenderingContextValue | undefined
>(undefined);

const useCommentRenderingContext = (): CommentRenderingContextValue => {
  const value = useContext(CommentRenderingContext);
  if (!value) throw new Error("Missing comment rendering context.");
  return value;
};

const createCommentableComponent = (
  tagName: keyof React.JSX.IntrinsicElements,
  renderElement?: (
    elementProps: Omit<ComponentProps, "children" | "node">,
    children: React.ReactNode,
  ) => React.ReactNode,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const {
      commentsByLine,
      commentHighlightsByLine,
      ...props
    } = useCommentRenderingContext();
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const element = renderElement
      ? renderElement(elementProps, children)
      : createElement(tagName, elementProps, children);
    if (line === undefined) return element;
    if (ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock
        activeRange={props.activeRange}
        comments={commentsByLine.get(line) ?? []}
        hasCommentHighlight={commentHighlightsByLine.has(line)}
        isAdding={props.activeCommentLine === line}
        isRangeActionLine={props.selectedRange?.endLine === line}
        isSelected={props.selectedRange
          ? isLineInRange(line, props.selectedRange)
          : false}
        line={line}
        onCloseCommentForm={props.onCloseCommentForm}
        onCreateComment={props.onCreateComment}
        onDeleteComment={props.onDeleteComment}
        onDeleteReply={props.onDeleteReply}
        onOpenCommentForm={props.onOpenCommentForm}
        onSelectCommentLine={props.onSelectCommentLine}
        onReplyComment={props.onReplyComment}
        onResolveComment={props.onResolveComment}
        onUpdateComment={props.onUpdateComment}
        onUpdateReply={props.onUpdateReply}
        selectedRange={props.selectedRange}
      >
        {element}
      </CommentableBlock>
    );
  };
};

const createCommentableListItem = () => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const {
      commentsByLine,
      commentHighlightsByLine,
      ...props
    } = useCommentRenderingContext();
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const { itemChildren, nestedLists } = splitListItemChildren(children);
    if (line === undefined) {
      return <List.Item {...elementProps}>{children}</List.Item>;
    }
    if (ancestorSourceLines.has(line)) {
      return <List.Item {...elementProps}>{children}</List.Item>;
    }

    return (
      <List.Item {...elementProps}>
        <CommentableBlock
          activeRange={props.activeRange}
          className="commentable-list-item"
          comments={commentsByLine.get(line) ?? []}
          hasCommentHighlight={commentHighlightsByLine.has(line)}
          isAdding={props.activeCommentLine === line}
          isRangeActionLine={props.selectedRange?.endLine === line}
          isSelected={props.selectedRange
            ? isLineInRange(line, props.selectedRange)
            : false}
          line={line}
          onCloseCommentForm={props.onCloseCommentForm}
          onCreateComment={props.onCreateComment}
          onDeleteComment={props.onDeleteComment}
          onDeleteReply={props.onDeleteReply}
          onOpenCommentForm={props.onOpenCommentForm}
          onSelectCommentLine={props.onSelectCommentLine}
          onReplyComment={props.onReplyComment}
          onResolveComment={props.onResolveComment}
          onUpdateComment={props.onUpdateComment}
          onUpdateReply={props.onUpdateReply}
          selectedRange={props.selectedRange}
        >
          {itemChildren}
        </CommentableBlock>
        {nestedLists}
      </List.Item>
    );
  };
};

const createCommentablePre = () => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const {
      commentsByLine,
      commentHighlightsByLine,
      ...props
    } = useCommentRenderingContext();
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const mermaidCode = getMermaidCodeText(children);
    const element = mermaidCode === undefined
      ? (
        <Box
          as="pre"
          overflow="auto"
          borderWidth="1px"
          borderColor="border.muted"
          borderRadius="6px"
          p="4"
          bg="canvas.subtle"
          color="code.fg"
          lineHeight="1.45"
          mt="0"
          mb="4"
          {...elementProps}
        >
          <CodeBlockContext.Provider value={true}>
            {children}
          </CodeBlockContext.Provider>
        </Box>
      )
      : (
        <div className="mermaid-container">
          <pre className="mermaid">{mermaidCode}</pre>
          <Button
            aria-label="Zoom Mermaid diagram"
            className="mermaid-zoom-button"
            size="xs"
            title="Zoom Mermaid diagram"
            type="button"
            variant="outline"
          >
            Zoom
          </Button>
        </div>
      );
    if (line === undefined) return element;
    if (ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock
        activeRange={props.activeRange}
        comments={commentsByLine.get(line) ?? []}
        hasCommentHighlight={commentHighlightsByLine.has(line)}
        isAdding={props.activeCommentLine === line}
        isRangeActionLine={props.selectedRange?.endLine === line}
        isSelected={props.selectedRange
          ? isLineInRange(line, props.selectedRange)
          : false}
        line={line}
        onCloseCommentForm={props.onCloseCommentForm}
        onCreateComment={props.onCreateComment}
        onDeleteComment={props.onDeleteComment}
        onDeleteReply={props.onDeleteReply}
        onOpenCommentForm={props.onOpenCommentForm}
        onSelectCommentLine={props.onSelectCommentLine}
        onReplyComment={props.onReplyComment}
        onResolveComment={props.onResolveComment}
        onUpdateComment={props.onUpdateComment}
        onUpdateReply={props.onUpdateReply}
        selectedRange={props.selectedRange}
      >
        {element}
      </CommentableBlock>
    );
  };
};

export const MarkdownPreview = ({
  comments,
  markdown,
  onCreateComment,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
}: MarkdownPreviewProps) => {
  const commentsByLine = useMemo(() => {
    const grouped = new Map<number, PreviewComment[]>();
    for (const comment of comments) {
      grouped.set(comment.endLine, [
        ...(grouped.get(comment.endLine) ?? []),
        comment,
      ]);
    }
    return grouped;
  }, [comments]);
  const commentHighlightsByLine = useMemo(() => {
    const highlighted = new Set<number>();
    for (const comment of comments) {
      for (let line = comment.startLine; line <= comment.endLine; line += 1) {
        highlighted.add(line);
      }
    }
    return highlighted;
  }, [comments]);

  const [activeCommentLine, setActiveCommentLine] = useState<number>();
  const [activeRange, setActiveRange] = useState<CommentRange>();
  const [lineSelectionAnchor, setLineSelectionAnchor] = useState<number>();
  const [selectedRange, setSelectedRange] = useState<CommentRange>();

  const handleSelectCommentLine = (line: number) => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelectedRange((current) => {
      if (current && isLineInRange(line, current)) {
        setLineSelectionAnchor(undefined);
        return undefined;
      }
      const range = lineSelectionAnchor === undefined
        ? { endLine: line, startLine: line }
        : {
          endLine: Math.max(lineSelectionAnchor, line),
          startLine: Math.min(lineSelectionAnchor, line),
        };
      setLineSelectionAnchor(lineSelectionAnchor ?? line);
      return range;
    });
  };

  const handleOpenCommentForm = () => {
    if (!selectedRange) return;
    setActiveCommentLine(selectedRange.endLine);
    setActiveRange(selectedRange);
  };

  const handleCloseCommentForm = () => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelectedRange(undefined);
    setLineSelectionAnchor(undefined);
  };

  const components = useMemo<Components>(() => {
    return {
      a({ children, className, node: _node, ...props }) {
        const isHeadingAnchor = className?.split(/\s+/).includes(
          "heading-anchor",
        ) ?? false;
        return (
          <Box
            as="a"
            className={className}
            color={isHeadingAnchor ? "inherit" : "link"}
            textDecoration="none"
            _hover={isHeadingAnchor ? undefined : {
              textDecoration: "underline",
            }}
            {...props}
          >
            {children}
          </Box>
        );
      },
      blockquote: createCommentableComponent(
        "blockquote",
        (elementProps, children) => (
          <Box
            as="blockquote"
            borderColor="border.default"
            borderLeftWidth="4px"
            color="fg.muted"
            mt="0"
            mb="4"
            pl="4"
            {...elementProps}
          >
            {children}
          </Box>
        ),
      ),
      h1: createCommentableComponent(
        "h1",
        (elementProps, children) => renderHeading("h1", elementProps, children),
      ),
      h2: createCommentableComponent(
        "h2",
        (elementProps, children) => renderHeading("h2", elementProps, children),
      ),
      h3: createCommentableComponent(
        "h3",
        (elementProps, children) => renderHeading("h3", elementProps, children),
      ),
      h4: createCommentableComponent(
        "h4",
        (elementProps, children) => renderHeading("h4", elementProps, children),
      ),
      h5: createCommentableComponent(
        "h5",
        (elementProps, children) => renderHeading("h5", elementProps, children),
      ),
      h6: createCommentableComponent(
        "h6",
        (elementProps, children) => renderHeading("h6", elementProps, children),
      ),
      hr: createCommentableComponent(
        "hr",
        (elementProps) => (
          <Box mt="6" mb="6">
            <Separator
              as="hr"
              borderColor="border.muted"
              m="0"
              {...elementProps}
            />
          </Box>
        ),
      ),
      li: createCommentableListItem(),
      img({ className, node: _node, ...props }) {
        return (
          <Box
            as="img"
            className={className}
            maxW="100%"
            h="auto"
            {...props}
          />
        );
      },
      ol({ children, className, node: _node, ...props }) {
        const listDepth = useContext(ListDepthContext);
        const isNested = listDepth > 0;
        return (
          <ListDepthContext.Provider value={listDepth + 1}>
            <List.Root
              as="ol"
              className={mergeClassNames("comment-markdown-list", className)}
              listStylePosition="outside"
              mt={isNested ? "0.25em" : "2"}
              mb={isNested ? "0" : "4"}
              ps={`${listIndentEm}em`}
              {...props}
            >
              {children}
            </List.Root>
          </ListDepthContext.Provider>
        );
      },
      ul({ children, className, node: _node, ...props }) {
        const listDepth = useContext(ListDepthContext);
        const isNested = listDepth > 0;
        return (
          <ListDepthContext.Provider value={listDepth + 1}>
            <List.Root
              as="ul"
              className={mergeClassNames("comment-markdown-list", className)}
              listStylePosition="outside"
              mt={isNested ? "0.25em" : "2"}
              mb={isNested ? "0" : "4"}
              ps={`${listIndentEm}em`}
              {...props}
            >
              {children}
            </List.Root>
          </ListDepthContext.Provider>
        );
      },
      p: createCommentableComponent(
        "p",
        (elementProps, children) => (
          <Text as="p" mt="0" mb="4" {...elementProps}>
            {children}
          </Text>
        ),
      ),
      pre: createCommentablePre(),
      table: createCommentableComponent(
        "table",
      ),
      code({ children, className, ...props }) {
        const isCodeBlock = useContext(CodeBlockContext);
        return (
          <Box
            as="code"
            className={className}
            borderRadius={isCodeBlock ? "0" : "6px"}
            px={isCodeBlock ? "0" : "0.4em"}
            py={isCodeBlock ? "0" : "0.2em"}
            bg={isCodeBlock ? "transparent" : "code.bg"}
            color={isCodeBlock ? "code.fg" : "fg"}
            fontFamily="mono"
            fontSize={isCodeBlock ? "0.85rem" : "0.85em"}
            {...props}
          >
            {children}
          </Box>
        );
      },
    };
  }, []);

  const commentRenderingContext = {
    activeCommentLine,
    activeRange,
    commentsByLine,
    commentHighlightsByLine,
    onCloseCommentForm: handleCloseCommentForm,
    onCreateComment,
    onDeleteComment,
    onDeleteReply,
    onOpenCommentForm: handleOpenCommentForm,
    onSelectCommentLine: handleSelectCommentLine,
    onReplyComment,
    onResolveComment,
    onUpdateComment,
    onUpdateReply,
    selectedRange,
  };

  return (
    <CommentRenderingContext.Provider value={commentRenderingContext}>
      <ReactMarkdown
        components={components}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, {
            behavior: "wrap",
            properties: { className: "heading-anchor" },
          }],
          rehypeHighlight,
        ]}
        remarkPlugins={[remarkGfm]}
      >
        {markdown}
      </ReactMarkdown>
    </CommentRenderingContext.Provider>
  );
};
