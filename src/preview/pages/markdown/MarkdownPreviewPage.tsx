import { useCommentActions, useCommentsQuery } from "../../hooks/useComments";
import { isUnresolvedComment } from "../../models/comment";
import { MarkdownPreview, type MarkdownPreviewProps } from "./MarkdownPreview";
import { Button, Flex, Text } from "@chakra-ui/react";
import { useTableLayouts } from "../../hooks/useTableLayouts";
import { TableLayoutContext } from "../../markdown/tableLayoutContext";

type MarkdownPreviewPageProps = Pick<
  MarkdownPreviewProps,
  | "documentPath"
  | "markdown"
  | "previousMarkdown"
  | "showHtmlComments"
  | "theme"
> & { documentId?: number };

export const MarkdownPreviewPage = ({
  documentId,
  documentPath,
  markdown,
  previousMarkdown,
  showHtmlComments,
  theme,
}: MarkdownPreviewPageProps) => {
  const commentsQuery = useCommentsQuery(documentId);
  const actions = useCommentActions(documentId);
  const tableLayouts = useTableLayouts(documentId, markdown, documentPath);
  if (!commentsQuery.data) return null;

  const unresolvedComments =
    commentsQuery.data.comments.filter(isUnresolvedComment);
  return (
    <TableLayoutContext.Provider value={tableLayouts}>
      {tableLayouts.state.status === "error" && (
        <Flex gap="2" align="center">
          <Text role="alert" fontSize="sm">
            Could not restore column widths. {tableLayouts.state.message}
          </Text>
          <Button size="xs" variant="outline" onClick={tableLayouts.retry}>
            Retry
          </Button>
        </Flex>
      )}
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
};
