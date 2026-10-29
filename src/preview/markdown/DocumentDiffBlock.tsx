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
  >
    <Box
      as="span"
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
