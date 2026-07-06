import {
  Blockquote,
  Button,
  Code,
  Heading,
  Link,
  Separator,
  Table,
  Text,
  TextArea,
} from "@radix-ui/themes";
import {
  Children,
  createContext,
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
}: CommentableBlockProps) => {
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRange = activeRange ?? {
    endLine: line,
    startLine: line,
  };
  const [error, setError] = useState<string>();
  const ancestorSourceLines = useContext(SourceLineContext);
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
        className,
      ].filter(Boolean).join(" ")}
      data-source-line={line}
    >
      <div
        className="commentable-content"
        onClick={handleContentClick}
        title={`Select line ${line} for comment`}
      >
        <div className="comment-markdown-body">
          {isRangeActionLine && !isAdding && (
            <button
              className="comment-selection-button"
              onClick={onOpenCommentForm}
              type="button"
            >
              Add comment
            </button>
          )}
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
            <div className="comment-form">
              <Text
                as="div"
                className="comment-range-hint"
                color="gray"
                size="2"
              >
                Commenting on {formatRangeLabel(pendingRange)}.
              </Text>
              <TextArea
                autoFocus
                className="comment-input"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) =>
                  submitCommentOnShortcut(event, () => {
                    void handleCreate();
                  })}
                placeholder="Write a GitHub PR comment..."
                value={draft}
              />
              <div className="comment-actions">
                <Button
                  disabled={isSaving || draft.trim() === ""}
                  onClick={handleCreate}
                  size="1"
                  type="button"
                >
                  Add comment
                </Button>
                <Button
                  color="gray"
                  disabled={isSaving}
                  onClick={() => {
                    onCloseCommentForm();
                  }}
                  size="1"
                  type="button"
                  variant="soft"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {error && (
            <Text className="comment-error" color="red" size="2">{error}</Text>
          )}
        </div>
      )}
    </div>
  );
};

type ComponentProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
  node?: SourceNode;
};

type MarkdownElementRenderer = (
  props: Omit<ComponentProps, "node">,
) => React.ReactElement;

const isListElement = (
  child: React.ReactNode,
): child is React.ReactElement =>
  isValidElement(child) && (child.type === "ol" || child.type === "ul");

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

const createCommentableComponent = (
  renderElement: MarkdownElementRenderer,
  commentsByLine: Map<number, PreviewComment[]>,
  commentHighlightsByLine: Set<number>,
  props: CommentControlProps,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const element = renderElement({ ...elementProps, children });
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
      >
        {element}
      </CommentableBlock>
    );
  };
};

const createCommentableListItem = (
  commentsByLine: Map<number, PreviewComment[]>,
  commentHighlightsByLine: Set<number>,
  props: CommentControlProps,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const { itemChildren, nestedLists } = splitListItemChildren(children);
    if (line === undefined) return <li {...elementProps}>{children}</li>;
    if (ancestorSourceLines.has(line)) {
      return <li {...elementProps}>{children}</li>;
    }

    return (
      <li {...elementProps}>
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
        >
          {itemChildren}
        </CommentableBlock>
        {nestedLists}
      </li>
    );
  };
};

const createCommentablePre = (
  commentsByLine: Map<number, PreviewComment[]>,
  commentHighlightsByLine: Set<number>,
  props: CommentControlProps,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const mermaidCode = getMermaidCodeText(children);
    const element = mermaidCode === undefined
      ? <pre {...elementProps}>{children}</pre>
      : (
        <div className="mermaid-container">
          <pre className="mermaid">{mermaidCode}</pre>
          <Button
            aria-label="Zoom Mermaid diagram"
            className="mermaid-zoom-button"
            size="1"
            title="Zoom Mermaid diagram"
            type="button"
            variant="soft"
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
    const commentCallbacks = {
      activeCommentLine,
      activeRange,
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
    return {
      a({ children, className, href, title }) {
        return (
          <Link className={className} href={href} title={title}>
            {children}
          </Link>
        );
      },
      blockquote: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Blockquote size="3" {...elementProps}>
            {children}
          </Blockquote>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      code({ children, className, ...props }) {
        if (className) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }

        return <Code {...props}>{children}</Code>;
      },
      h1: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h1" mb="4" size="8" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      h2: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h2" mb="4" mt="6" size="6" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      h3: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h3" mb="3" mt="5" size="5" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      h4: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h4" mb="3" mt="4" size="4" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      h5: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h5" mb="2" mt="4" size="3" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      h6: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading
            as="h6"
            color="gray"
            mb="2"
            mt="4"
            size="2"
            {...elementProps}
          >
            {children}
          </Heading>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      hr() {
        return <Separator my="5" size="4" />;
      },
      li: createCommentableListItem(
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      p: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Text as="p" mb="4" size="3" {...elementProps}>
            {children}
          </Text>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      pre: createCommentablePre(
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      table: createCommentableComponent(
        ({ children }) => (
          <Table.Root className="markdown-table" size="2" variant="surface">
            {children}
          </Table.Root>
        ),
        commentsByLine,
        commentHighlightsByLine,
        commentCallbacks,
      ),
      tbody({ children }) {
        return <Table.Body>{children}</Table.Body>;
      },
      td({ children, style }) {
        return <Table.Cell style={style}>{children}</Table.Cell>;
      },
      th({ children, style }) {
        return (
          <Table.ColumnHeaderCell style={style}>
            {children}
          </Table.ColumnHeaderCell>
        );
      },
      thead({ children }) {
        return <Table.Header>{children}</Table.Header>;
      },
      tr({ children }) {
        return <Table.Row>{children}</Table.Row>;
      },
    };
  }, [
    activeCommentLine,
    activeRange,
    commentsByLine,
    commentHighlightsByLine,
    lineSelectionAnchor,
    onCreateComment,
    onDeleteComment,
    onDeleteReply,
    onReplyComment,
    onResolveComment,
    onUpdateComment,
    onUpdateReply,
    selectedRange,
  ]);

  return (
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
  );
};
