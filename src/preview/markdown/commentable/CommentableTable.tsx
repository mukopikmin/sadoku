import { Table } from "@chakra-ui/react";
import { Children, cloneElement, isValidElement, useContext } from "react";
import type { ReactNode } from "react";
import { CommentableBlock } from "./CommentableBlock";
import {
  getCommentableBlockProps,
  getSourceRange,
  SourceLineContext,
  useCommentRenderingContext,
} from "./commentRendering";
import type { MarkdownComponentProps } from "../rendererTypes";

export const CommentableTableRow = ({
  children,
  node,
  ...props
}: MarkdownComponentProps<"tr">) => {
  const context = useCommentRenderingContext();
  const ancestors = useContext(SourceLineContext);
  const sourceRange = getSourceRange({ node });
  if (!sourceRange || ancestors.has(sourceRange.startLine)) {
    return <Table.Row {...props}>{children}</Table.Row>;
  }
  const cells = Children.toArray(children).filter(
    isValidElement<{ children?: ReactNode }>,
  );
  return (
    <CommentableBlock
      {...getCommentableBlockProps(context, sourceRange)}
      renderLayout={({
        blockProps,
        content,
        gutter,
        anchor,
        thread,
        onContentClick,
      }) => (
        <>
          {content(
            anchor(
              <Table.Row
                {...props}
                {...blockProps}
                className={`${blockProps.className} commentable-content`}
                onClick={onContentClick}
              >
                {cells.map((cell, index) =>
                  index === 0
                    ? cloneElement(
                        cell,
                        {},
                        <>
                          {gutter}
                          {cell.props.children}
                        </>,
                      )
                    : cell,
                )}
              </Table.Row>,
            ),
          )}
          {thread && (
            <Table.Row>
              <Table.Cell colSpan={cells.length}>{thread}</Table.Cell>
            </Table.Row>
          )}
        </>
      )}
    >
      {children}
    </CommentableBlock>
  );
};

export const CommentableTableHeader = ({
  node,
  ...props
}: MarkdownComponentProps<"thead">) => {
  const context = useCommentRenderingContext();
  const range = getSourceRange({ node });
  const block = range ? getCommentableBlockProps(context, range) : undefined;
  return (
    <Table.Header
      {...props}
      bg={
        block && (block.hasRangeHighlight || block.comments.length > 0)
          ? "transparent"
          : undefined
      }
      _hover={{ bg: "transparent" }}
      _focusWithin={{ bg: "transparent" }}
    />
  );
};
