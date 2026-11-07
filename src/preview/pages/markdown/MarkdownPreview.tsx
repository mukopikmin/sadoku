import { Box, DataList } from "@chakra-ui/react";
import { type ReactNode } from "react";
import type { CommentActions } from "../../api/commentActions";
import type { UnresolvedComment } from "../../models/comment";
import { CommentableBlock } from "../../markdown/commentable/CommentableBlock";
import { CommentableMarkdown } from "../../markdown/commentable/CommentableMarkdown";
import { getCommentableBlockProps } from "../../markdown/commentable/commentableMarkdownComponents";
import { CommentRenderingContext } from "../../markdown/commentable/commentRendering";
import { HighlightOverlay } from "../../markdown/HighlightOverlay";
import { RawMarkdownDialog } from "./RawMarkdownDialog";
import { DocumentDiffBlock } from "../../markdown/DocumentDiffBlock";
import {
  DeletedCommentsContext,
  DeletedMarkdownBlock,
} from "../../markdown/commentable/DeletedMarkdownBlock";
import { useMarkdownPreview } from "./useMarkdownPreview";

export type MarkdownPreviewProps = {
  actions: CommentActions;
  comments: UnresolvedComment[];
  documentPath?: string;
  markdown: string;
  previousMarkdown?: string;
  showHtmlComments: boolean;
  theme: "dark" | "default";
};

export const MarkdownPreview = ({
  actions,
  comments,
  documentPath,
  markdown,
  previousMarkdown,
  showHtmlComments,
  theme,
}: MarkdownPreviewProps) => {
  const preview = useMarkdownPreview({
    actions,
    comments,
    documentPath,
    markdown,
    previousMarkdown,
    showHtmlComments,
    theme,
  });
  const {
    frontMatter,
    previousFrontMatter,
    frontMatterChanged,
    renderedMarkdown,
    previewRef,
    rangeHighlightLayouts,
    commentRenderingContext,
    deletedCommentsByLine,
    raw,
  } = preview;

  return (
    <CommentRenderingContext.Provider value={commentRenderingContext}>
      <DeletedCommentsContext.Provider value={deletedCommentsByLine}>
        <RawMarkdownDialog
          markdown={markdown}
          onOpenChange={(open) => {
            if (!open) preview.closeRaw();
          }}
          open={raw.status === "open"}
          range={raw.status === "open" ? raw.range : undefined}
        />
        <Box
          className="markdown-preview"
          data-document-diff={previousMarkdown !== undefined ? "" : undefined}
          ref={previewRef}
        >
          <HighlightOverlay layouts={rangeHighlightLayouts} />
          {frontMatterChanged && previousFrontMatter && (
            <DeletedMarkdownBlock
              previousStartLine={1}
              previousEndLine={previousFrontMatter.endLine}
              documentPath={documentPath}
              markdown={previousMarkdown!
                .split(/\r?\n/)
                .slice(0, previousFrontMatter.endLine)
                .join("\n")}
              showHtmlComments={showHtmlComments}
              theme={theme}
            />
          )}
          {frontMatter && (
            <FrontMatterDiff changed={frontMatterChanged}>
              <DataList.Root
                orientation={{ base: "vertical", md: "horizontal" }}
                gap="0"
              >
                {frontMatter.items.map((item) => (
                  <CommentableBlock
                    {...getCommentableBlockProps(commentRenderingContext, {
                      startLine: item.startLine,
                      endLine: item.endLine,
                    })}
                    key={`${item.key}-${item.startLine}`}
                  >
                    <DataList.Item
                      alignItems="start"
                      gap={{ base: "1", md: "2" }}
                      py="1"
                    >
                      <DataList.ItemLabel minW={{ md: "auto" }}>
                        {item.key}
                      </DataList.ItemLabel>
                      <DataList.ItemValue
                        minW="0"
                        overflowWrap="anywhere"
                        whiteSpace="pre-wrap"
                      >
                        {item.value}
                      </DataList.ItemValue>
                    </DataList.Item>
                  </CommentableBlock>
                ))}
              </DataList.Root>
            </FrontMatterDiff>
          )}
          <CommentableMarkdown
            documentPath={documentPath}
            previousMarkdown={
              previousFrontMatter?.bodyMarkdown ?? previousMarkdown
            }
            showHtmlComments={showHtmlComments}
            theme={theme}
          >
            {renderedMarkdown}
          </CommentableMarkdown>
        </Box>
      </DeletedCommentsContext.Provider>
    </CommentRenderingContext.Provider>
  );
};

const FrontMatterDiff = ({
  changed,
  children,
}: {
  changed: boolean;
  children: ReactNode;
}) =>
  changed ? (
    <DocumentDiffBlock kind="addition">{children}</DocumentDiffBlock>
  ) : (
    children
  );
