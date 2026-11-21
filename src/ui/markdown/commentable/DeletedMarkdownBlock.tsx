import { Stack } from "@chakra-ui/react";
import { createContext, useContext } from "react";
import { CommentItem } from "../../components/comments/CommentItem";
import type { StaleComment } from "../../models/comment";
import { ReadOnlyMarkdownPreview } from "../../pages/markdown/ReadOnlyMarkdownPreview";
import { DocumentDiffBlock } from "../DocumentDiffBlock";
import {
  formatRangeLabel,
  useCommentRenderingContext,
} from "./commentRendering";

export const DeletedCommentsContext = createContext<
  ReadonlyMap<number, StaleComment[]>
>(new Map());

export const DeletedMarkdownBlock = ({
  markdown,
  previousStartLine,
  previousEndLine,
  documentPath,
  showHtmlComments,
  theme,
}: {
  markdown: string;
  previousStartLine: number;
  previousEndLine: number;
  documentPath?: string;
  showHtmlComments: boolean;
  theme: "dark" | "default";
}) => {
  const { actions } = useCommentRenderingContext();
  const comments =
    useContext(DeletedCommentsContext).get(previousStartLine) ?? [];
  return (
    <DocumentDiffBlock
      kind="deletion"
      previousRange={{ startLine: previousStartLine, endLine: previousEndLine }}
    >
      <Stack gap="3">
        <ReadOnlyMarkdownPreview
          markdown={markdown}
          documentPath={documentPath}
          showHtmlComments={showHtmlComments}
          theme={theme}
        />
        {comments.length > 0 && (
          <Stack className="comment-thread" gap="3">
            {comments.map((comment) => (
              <CommentItem
                actions={actions}
                comment={comment}
                key={comment.id}
                lineLabel={`Previously ${formatRangeLabel(comment)}`}
                showState
              />
            ))}
          </Stack>
        )}
      </Stack>
    </DocumentDiffBlock>
  );
};
