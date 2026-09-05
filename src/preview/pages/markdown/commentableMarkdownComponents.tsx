import { List } from "@chakra-ui/react";
import { Children, createElement, isValidElement, useContext } from "react";
import type React from "react";
import type { Components } from "react-markdown";
import { CommentableBlock } from "./CommentableBlock";
import {
  type CommentableComponentProps,
  type CommentRenderingContextValue,
  getSourceLine,
  getSourceRange,
  SourceLineContext,
  useCommentRenderingContext,
} from "./commentRendering";
import {
  MarkdownListDepthContext,
  renderMarkdownBlockquote,
  renderMarkdownHeading,
  renderMarkdownHorizontalRule,
  renderMarkdownHtmlComment,
  renderMarkdownParagraph,
  renderMarkdownPre,
  renderMarkdownTable,
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

export const getCommentableBlockProps = (
  context: CommentRenderingContextValue,
  sourceRange: { endLine: number; startLine: number },
) => {
  const {
    commentsByLine,
    commentHighlightsByLine,
    ...props
  } = context;
  const { endLine, startLine } = sourceRange;
  const comments = [...commentsByLine.entries()].flatMap(([line, comments]) =>
    line >= startLine && line <= endLine ? comments : []
  );
  const hasContinuousSelection = props.selectedRange !== undefined &&
    props.selectedRange.startLine < props.selectedRange.endLine &&
    props.selectedRange.endLine >= startLine &&
    props.selectedRange.startLine <= endLine;

  return {
    ...props,
    comments,
    hasCommentHighlight: [...commentHighlightsByLine].some((line) =>
      line >= startLine && line <= endLine
    ),
    hasContinuousHighlight: hasContinuousSelection ||
      comments.some((comment) => comment.startLine < comment.endLine),
    isAdding: props.activeCommentLine !== undefined &&
      props.activeCommentLine >= startLine &&
      props.activeCommentLine <= endLine,
    isRangeActionLine: props.selectedRange !== undefined &&
      props.selectedRange.endLine >= startLine &&
      props.selectedRange.endLine <= endLine,
    isSelected: props.selectedRange
      ? props.selectedRange.startLine === startLine &&
        props.selectedRange.endLine === endLine
      : false,
    sourceRange,
  };
};

const createCommentableComponent = (
  tagName: string,
  renderElement?: (
    elementProps: Omit<CommentableComponentProps, "children" | "node">,
    children: React.ReactNode,
  ) => React.ReactNode,
  isHeading = false,
) => {
  return ({
    children,
    node,
    ...elementProps
  }: CommentableComponentProps) => {
    const context = useCommentRenderingContext();
    const ancestorSourceLines = useContext(SourceLineContext);
    const sourceRange = getSourceRange({ node });
    const element = renderElement
      ? renderElement(elementProps, children)
      : createElement(tagName, elementProps, children);
    if (!sourceRange || ancestorSourceLines.has(sourceRange.startLine)) {
      return element;
    }

    return (
      <CommentableBlock
        {...getCommentableBlockProps(context, sourceRange)}
        headingId={isHeading && typeof elementProps.id === "string"
          ? elementProps.id
          : undefined}
      >
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
          {...getCommentableBlockProps(context, {
            startLine: line,
            endLine: line,
          })}
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
    const sourceRange = getSourceRange({ node });
    const element = renderMarkdownPre(elementProps, children);
    if (!sourceRange || ancestorSourceLines.has(sourceRange.startLine)) {
      return element;
    }

    return (
      <CommentableBlock {...getCommentableBlockProps(context, sourceRange)}>
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
    true,
  ),
  h2: createCommentableComponent(
    "h2",
    (elementProps, children) =>
      renderMarkdownHeading("h2", elementProps, children),
    true,
  ),
  h3: createCommentableComponent(
    "h3",
    (elementProps, children) =>
      renderMarkdownHeading("h3", elementProps, children),
    true,
  ),
  h4: createCommentableComponent(
    "h4",
    (elementProps, children) =>
      renderMarkdownHeading("h4", elementProps, children),
    true,
  ),
  h5: createCommentableComponent(
    "h5",
    (elementProps, children) =>
      renderMarkdownHeading("h5", elementProps, children),
    true,
  ),
  h6: createCommentableComponent(
    "h6",
    (elementProps, children) =>
      renderMarkdownHeading("h6", elementProps, children),
    true,
  ),
  hr: createCommentableComponent("hr", renderMarkdownHorizontalRule),
  "html-comment": createCommentableComponent(
    "html-comment",
    renderMarkdownHtmlComment,
  ),
  input: sharedMarkdownComponents.input,
  li: createCommentableListItem(),
  img: sharedMarkdownComponents.img,
  ol: sharedMarkdownComponents.ol,
  ul: sharedMarkdownComponents.ul,
  p: createCommentableComponent("p", renderMarkdownParagraph),
  pre: createCommentablePre(),
  table: createCommentableComponent("table", renderMarkdownTable),
  tbody: sharedMarkdownComponents.tbody,
  td: sharedMarkdownComponents.td,
  th: sharedMarkdownComponents.th,
  thead: sharedMarkdownComponents.thead,
  tr: sharedMarkdownComponents.tr,
  code: sharedMarkdownComponents.code,
});
