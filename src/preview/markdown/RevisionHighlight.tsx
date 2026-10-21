import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

export const RevisionHighlight = ({ children, kind }: {
  children?: ReactNode;
  kind: "addition" | "deletion";
}) => (
  <Box
    as={kind === "addition" ? "ins" : "del"}
    bg={`syntax.${kind}.bg`}
    borderStartWidth="3px"
    borderColor={`syntax.${kind}.fg`}
    display="block"
    px="2"
    textDecoration="none"
    title={kind === "addition"
      ? "Added or changed since previous revision"
      : "Removed or changed in current revision"}
  >
    {children}
  </Box>
);
