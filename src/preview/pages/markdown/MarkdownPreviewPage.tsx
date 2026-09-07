import {
  useCommentActions,
  useCommentsQuery,
} from "../../hooks/usePreviewData";
import type { ActiveComment } from "../../models/comment";
import { MarkdownPreview, type MarkdownPreviewProps } from "./MarkdownPreview";

type MarkdownPreviewPageProps =
  & Pick<
    MarkdownPreviewProps,
    "documentPath" | "markdown" | "showHtmlComments" | "theme"
  >
  & { documentId?: number };

export const MarkdownPreviewPage = ({
  documentId,
  documentPath,
  markdown,
  showHtmlComments,
  theme,
}: MarkdownPreviewPageProps) => {
  const commentsQuery = useCommentsQuery(documentId);
  const actions = useCommentActions(documentId);
  if (!commentsQuery.data) return null;

  const activeComments = commentsQuery.data.comments.filter(
    (comment): comment is ActiveComment => comment.state === "active",
  );
  return (
    <MarkdownPreview
      actions={actions}
      comments={activeComments}
      documentPath={documentPath}
      markdown={markdown}
      showHtmlComments={showHtmlComments}
      theme={theme}
    />
  );
};
