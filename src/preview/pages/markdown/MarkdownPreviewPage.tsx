import { useCommentActions, useCommentsQuery } from "../../hooks/useComments";
import { isUnresolvedComment } from "../../models/comment";
import { MarkdownPreview, type MarkdownPreviewProps } from "./MarkdownPreview";
import { useTableLayouts } from "../../hooks/useTableLayouts";
import { TableLayoutContext } from "../../markdown/tableLayoutContext";
import { memo } from "react";

type MarkdownPreviewPageProps = Pick<
  MarkdownPreviewProps,
  | "documentPath"
  | "markdown"
  | "previousMarkdown"
  | "showHtmlComments"
  | "theme"
> & { documentId?: number };

export const MarkdownPreviewPage = memo(function MarkdownPreviewPage({
  documentId,
  documentPath,
  markdown,
  previousMarkdown,
  showHtmlComments,
  theme,
}: MarkdownPreviewPageProps) {
  const commentsQuery = useCommentsQuery(documentId);
  const actions = useCommentActions(documentId);
  const tableLayouts = useTableLayouts(documentId, markdown, documentPath);
  if (!commentsQuery.data) return null;

  const unresolvedComments =
    commentsQuery.data.comments.filter(isUnresolvedComment);
  return (
    <TableLayoutContext.Provider value={tableLayouts}>
      <MarkdownPreview
        actions={actions}
        comments={unresolvedComments}
        documentPath={documentPath}
        markdown={markdown}
        previousMarkdown={previousMarkdown}
        showHtmlComments={showHtmlComments}
        theme={theme}
      />
    </TableLayoutContext.Provider>
  );
});
