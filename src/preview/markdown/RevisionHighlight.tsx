import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

export const RevisionHighlight = ({ children, kind }: {
  children?: ReactNode;
  kind: "addition" | "deletion";
}) => (
  <Box
    as={kind === "addition" ? "ins" : "del"}
    data-revision-kind={kind}
    display="block"
    textDecoration="none"
    title={kind === "addition"
      ? "Added or changed since previous revision"
      : "Removed or changed in current revision"}
  >
    {children}
  </Box>
);
