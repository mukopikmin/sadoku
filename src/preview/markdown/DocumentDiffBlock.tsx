import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { CommentRange } from "./commentable/commentRanges";

export const DocumentDiffBlock = ({
  children,
  kind,
  previousRange,
}: {
  children: ReactNode;
  kind: "addition" | "deletion";
  previousRange?: CommentRange;
}) => (
  <Box
    className={`document-diff-${kind}`}
    data-revision-kind={kind}
    data-previous-source-line={previousRange?.startLine}
    data-previous-source-end-line={previousRange?.endLine}
    role="group"
    aria-label={kind === "addition" ? "Added content" : "Removed content"}
    borderLeftWidth="3px"
    borderLeftColor={`syntax.${kind}.fg`}
    position="relative"
    ps="3"
    css={{
      [`&:has(+ .document-diff-${kind})::after`]: {
        content: '""',
        position: "absolute",
        top: "100%",
        insetInlineStart: "-3px",
        insetInlineEnd: "0",
        height: "3",
        bg: `highlight.${kind}.bg`,
        borderInlineStartWidth: "3px",
        borderInlineStartColor: `syntax.${kind}.fg`,
        pointerEvents: "none",
      },
    }}
  >
    {children}
  </Box>
);
