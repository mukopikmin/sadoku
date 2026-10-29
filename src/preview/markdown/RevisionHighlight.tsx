import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

export const RevisionHighlight = ({ children, kind }: {
  children?: ReactNode;
  kind?: "addition" | "deletion";
}) => (
  <Box
    as={kind === undefined ? "div" : kind === "addition" ? "ins" : "del"}
    data-revision-block=""
    data-revision-kind={kind}
    display="block"
    textDecoration="none"
    title={kind === undefined ? undefined : kind === "addition"
      ? "Added or changed since previous revision"
      : "Removed or changed in current revision"}
  >
    {children}
  </Box>
);
