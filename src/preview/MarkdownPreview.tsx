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
  onCreateComment: (line: number, body: string) => Promise<void>;
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
  children: React.ReactNode;
  className?: string;
  comments: PreviewComment[];
  line: number;
  onCreateComment: (line: number, body: string) => Promise<void>;
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

const getSourceLine = (props: { node?: SourceNode }): number | undefined => {
  return props.node?.position?.start?.line;
};

const CommentableBlock = ({
  children,
  className,
  comments,
  line,
  onCreateComment,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
}: CommentableBlockProps) => {
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
      await onCreateComment(line, body);
      setDraft("");
      setIsAdding(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={["commentable-block", className].filter(Boolean).join(" ")}
      data-source-line={line}
    >
      <div className="commentable-content">
        <button
          aria-label={`Add comment on line ${line}`}
          className="comment-line-button"
          onClick={() => setIsAdding((value) => !value)}
          title={`Comment on line ${line}`}
          type="button"
        >
        </button>
        <SourceLineContext.Provider value={sourceLines}>
          {children}
        </SourceLineContext.Provider>
      </div>
      {(isAdding || comments.length > 0 || error) && (
        <div className="comment-thread">
          {comments.map((comment) => (
            <CommentItem
              comment={comment}
              key={comment.id}
              lineLabel={`Line ${line}`}
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
                  onClick={() => setIsAdding(false)}
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

const createCommentableComponent = (
  renderElement: MarkdownElementRenderer,
  commentsByLine: Map<number, PreviewComment[]>,
  props: Pick<
    MarkdownPreviewProps,
    | "onCreateComment"
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
  >,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const element = renderElement({ ...elementProps, children });
    if (line === undefined) return element;
    if (ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock
        comments={commentsByLine.get(line) ?? []}
        line={line}
        onCreateComment={props.onCreateComment}
        onDeleteComment={props.onDeleteComment}
        onDeleteReply={props.onDeleteReply}
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
  props: Pick<
    MarkdownPreviewProps,
    | "onCreateComment"
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
  >,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    if (line === undefined) return <li {...elementProps}>{children}</li>;
    if (ancestorSourceLines.has(line)) {
      return <li {...elementProps}>{children}</li>;
    }

    return (
      <li {...elementProps}>
        <CommentableBlock
          className="commentable-list-item"
          comments={commentsByLine.get(line) ?? []}
          line={line}
          onCreateComment={props.onCreateComment}
          onDeleteComment={props.onDeleteComment}
          onDeleteReply={props.onDeleteReply}
          onReplyComment={props.onReplyComment}
          onResolveComment={props.onResolveComment}
          onUpdateComment={props.onUpdateComment}
          onUpdateReply={props.onUpdateReply}
        >
          {children}
        </CommentableBlock>
      </li>
    );
  };
};

const createCommentablePre = (
  commentsByLine: Map<number, PreviewComment[]>,
  props: Pick<
    MarkdownPreviewProps,
    | "onCreateComment"
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
  >,
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
        comments={commentsByLine.get(line) ?? []}
        line={line}
        onCreateComment={props.onCreateComment}
        onDeleteComment={props.onDeleteComment}
        onDeleteReply={props.onDeleteReply}
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
      grouped.set(comment.line, [
        ...(grouped.get(comment.line) ?? []),
        comment,
      ]);
    }
    return grouped;
  }, [comments]);

  const components = useMemo<Components>(() => {
    const commentCallbacks = {
      onCreateComment,
      onDeleteComment,
      onDeleteReply,
      onReplyComment,
      onResolveComment,
      onUpdateComment,
      onUpdateReply,
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
        commentCallbacks,
      ),
      h2: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h2" mb="4" mt="6" size="6" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
        commentCallbacks,
      ),
      h3: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h3" mb="3" mt="5" size="5" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
        commentCallbacks,
      ),
      h4: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h4" mb="3" mt="4" size="4" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
        commentCallbacks,
      ),
      h5: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Heading as="h5" mb="2" mt="4" size="3" {...elementProps}>
            {children}
          </Heading>
        ),
        commentsByLine,
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
        commentCallbacks,
      ),
      hr() {
        return <Separator my="5" size="4" />;
      },
      li: createCommentableListItem(commentsByLine, commentCallbacks),
      p: createCommentableComponent(
        ({ children, ...elementProps }) => (
          <Text as="p" mb="4" size="3" {...elementProps}>
            {children}
          </Text>
        ),
        commentsByLine,
        commentCallbacks,
      ),
      pre: createCommentablePre(commentsByLine, commentCallbacks),
      table: createCommentableComponent(
        ({ children }) => (
          <Table.Root className="markdown-table" size="2" variant="surface">
            {children}
          </Table.Root>
        ),
        commentsByLine,
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
    commentsByLine,
    onCreateComment,
    onDeleteComment,
    onDeleteReply,
    onReplyComment,
    onResolveComment,
    onUpdateComment,
    onUpdateReply,
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
