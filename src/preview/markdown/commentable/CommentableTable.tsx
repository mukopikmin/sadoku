import { Popover, Portal, Table, useBreakpointValue } from "@chakra-ui/react";
import { Children, cloneElement, isValidElement, useContext } from "react";
import type { FlexProps } from "@chakra-ui/react";
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
  const floating = useBreakpointValue(
    { base: true, md: false },
    { fallback: "md" },
  );
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
        thread,
        onContentClick,
      }) => (
        <Popover.Root
          open={Boolean(floating && gutter)}
          autoFocus={false}
          closeOnInteractOutside={false}
          onOpenChange={({ open }) => {
            if (!open) context.onCloseCommentForm();
          }}
          positioning={{
            placement: "top-start",
            strategy: "fixed",
            flip: true,
            slide: true,
            hideWhenDetached: true,
          }}
        >
          {content(
            <Popover.Anchor asChild>
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
                          {!floating && gutter}
                          {cell.props.children}
                        </>,
                      )
                    : cell,
                )}
              </Table.Row>
            </Popover.Anchor>,
          )}
          {floating && gutter && (
            <Portal>
              <Popover.Positioner>
                <Popover.Content
                  aria-label="Table row actions"
                  width="auto"
                  p="2"
                >
                  {isValidElement<FlexProps>(gutter)
                    ? cloneElement(gutter, {
                        mb: "0",
                        left: "auto",
                        top: "auto",
                      })
                    : gutter}
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          )}
          {thread && (
            <Table.Row>
              <Table.Cell colSpan={cells.length}>{thread}</Table.Cell>
            </Table.Row>
          )}
        </Popover.Root>
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
