import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

export const DocumentDiffBlock = ({
  children,
  kind,
}: {
  children: ReactNode;
  kind: "addition" | "deletion";
}) => (
  <Box
    className={`document-diff-${kind}`}
    data-revision-kind={kind}
    role="group"
    aria-label={kind === "addition" ? "Added content" : "Removed content"}
    borderLeftWidth="3px"
    borderLeftColor={`syntax.${kind}.fg`}
    position="relative"
    ps="3"
    css={{
      [`& + .document-diff-${kind} > [data-diff-marker]`]: {
        display: "none",
      },
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
    <Box
      as="span"
      data-diff-marker=""
      aria-hidden="true"
      position="absolute"
      insetInlineStart="0"
      color={`syntax.${kind}.fg`}
      fontWeight="bold"
    >
      {kind === "addition" ? "+" : "−"}
    </Box>
    {children}
  </Box>
);
