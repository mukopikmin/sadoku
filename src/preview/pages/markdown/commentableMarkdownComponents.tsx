import { Button, List } from "@chakra-ui/react";
import { Children, createElement, isValidElement, useContext } from "react";
import type React from "react";
import type { Components } from "react-markdown";
import { CommentableBlock } from "./CommentableBlock";
import {
  type CommentableComponentProps,
  type CommentRenderingContextValue,
  getSourceLine,
  isLineInRange,
  SourceLineContext,
  useCommentRenderingContext,
} from "./commentRendering";
import {
  MarkdownListDepthContext,
  renderMarkdownBlockquote,
  renderMarkdownHeading,
  renderMarkdownHorizontalRule,
  renderMarkdownParagraph,
  renderMarkdownPre,
  sharedMarkdownComponents,
} from "../../markdown/markdownRenderers";

type ListElementProps = {
  node?: { tagName?: string };
};

const isListElement = (
  child: React.ReactNode,
): child is React.ReactElement<ListElementProps> =>
  isValidElement<ListElementProps>(child) &&
  (child.type === "ol" || child.type === "ul" ||
    child.props.node?.tagName === "ol" || child.props.node?.tagName === "ul");

const splitListItemChildren = (
  children: React.ReactNode,
): { itemChildren: React.ReactNode[]; nestedLists: React.ReactNode[] } => {
  const itemChildren: React.ReactNode[] = [];
  const nestedLists: React.ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (isListElement(child)) nestedLists.push(child);
    else itemChildren.push(child);
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
  if (!child.props.className?.match(/\blanguage-mermaid\b/)) return undefined;

  return String(child.props.children).replace(/\n$/, "");
};

const getCommentableBlockProps = (
  context: CommentRenderingContextValue,
  line: number,
) => {
  const {
    commentsByLine,
    commentHighlightsByLine,
    ...props
  } = context;
  const comments = commentsByLine.get(line) ?? [];
  const hasContinuousSelection = props.selectedRange !== undefined &&
    props.selectedRange.startLine < props.selectedRange.endLine &&
    isLineInRange(line, props.selectedRange);

  return {
    ...props,
    comments,
    hasCommentHighlight: commentHighlightsByLine.has(line),
    hasContinuousHighlight: hasContinuousSelection ||
      comments.some((comment) => comment.startLine < comment.endLine),
    isAdding: props.activeCommentLine === line,
    isRangeActionLine: props.selectedRange?.endLine === line,
    isSelected: props.selectedRange
      ? props.selectedRange.startLine === props.selectedRange.endLine &&
        isLineInRange(line, props.selectedRange)
      : false,
    line,
  };
};

const createCommentableComponent = (
  tagName: keyof React.JSX.IntrinsicElements,
  renderElement?: (
    elementProps: Omit<CommentableComponentProps, "children" | "node">,
    children: React.ReactNode,
  ) => React.ReactNode,
) => {
  return ({
    children,
    node,
    ...elementProps
  }: CommentableComponentProps) => {
    const context = useCommentRenderingContext();
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const element = renderElement
      ? renderElement(elementProps, children)
      : createElement(tagName, elementProps, children);
    if (line === undefined || ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock {...getCommentableBlockProps(context, line)}>
        {element}
      </CommentableBlock>
    );
  };
};

const createCommentableListItem = () => {
  return ({
    children,
    node,
    ...elementProps
  }: CommentableComponentProps) => {
    const context = useCommentRenderingContext();
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const { itemChildren, nestedLists } = splitListItemChildren(children);
    if (line === undefined || ancestorSourceLines.has(line)) {
      return <List.Item {...elementProps}>{children}</List.Item>;
    }

    return (
      <List.Item {...elementProps}>
        <CommentableBlock
          {...getCommentableBlockProps(context, line)}
          className="commentable-list-item"
        >
          {itemChildren}
        </CommentableBlock>
        {nestedLists}
      </List.Item>
    );
  };
};

const createCommentablePre = () => {
  return ({
    children,
    node,
    ...elementProps
  }: CommentableComponentProps) => {
    const context = useCommentRenderingContext();
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const mermaidCode = getMermaidCodeText(children);
    const element = mermaidCode === undefined
      ? renderMarkdownPre(elementProps, children)
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
    if (line === undefined || ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock {...getCommentableBlockProps(context, line)}>
        {element}
      </CommentableBlock>
    );
  };
};

export const createCommentableMarkdownComponents = (): Components => ({
  a: sharedMarkdownComponents.a,
  blockquote: createCommentableComponent(
    "blockquote",
    renderMarkdownBlockquote,
  ),
  h1: createCommentableComponent(
    "h1",
    (elementProps, children) =>
      renderMarkdownHeading("h1", elementProps, children),
  ),
  h2: createCommentableComponent(
    "h2",
    (elementProps, children) =>
      renderMarkdownHeading("h2", elementProps, children),
  ),
  h3: createCommentableComponent(
    "h3",
    (elementProps, children) =>
      renderMarkdownHeading("h3", elementProps, children),
  ),
  h4: createCommentableComponent(
    "h4",
    (elementProps, children) =>
      renderMarkdownHeading("h4", elementProps, children),
  ),
  h5: createCommentableComponent(
    "h5",
    (elementProps, children) =>
      renderMarkdownHeading("h5", elementProps, children),
  ),
  h6: createCommentableComponent(
    "h6",
    (elementProps, children) =>
      renderMarkdownHeading("h6", elementProps, children),
  ),
  hr: createCommentableComponent("hr", renderMarkdownHorizontalRule),
  input: sharedMarkdownComponents.input,
  li: createCommentableListItem(),
  img: sharedMarkdownComponents.img,
  ol: sharedMarkdownComponents.ol,
  ul: sharedMarkdownComponents.ul,
  p: createCommentableComponent("p", renderMarkdownParagraph),
  pre: createCommentablePre(),
  table: createCommentableComponent("table"),
  code: sharedMarkdownComponents.code,
});
