import { Box } from "@chakra-ui/react";
import { useContext } from "react";
import { CodeBlockContext } from "../codeBlockContext";
import type { MarkdownComponentProps } from "../rendererTypes";

export const MarkdownCode = ({
  children,
  className,
  node: _node,
  ...props
}: MarkdownComponentProps<"code">) => {
  const isCodeBlock = useContext(CodeBlockContext);
  return (
    <Box
      as="code"
      className={className}
      borderRadius={isCodeBlock ? "0" : "sm"}
      px={isCodeBlock ? "0" : "0.4em"}
      py={isCodeBlock ? "0" : "0.2em"}
      bg={isCodeBlock ? "transparent" : "code.bg"}
      color={isCodeBlock ? "code.fg" : "fg"}
      fontFamily="mono"
      fontSize={isCodeBlock ? "0.85rem" : "0.85em"}
      {...props}
    >
      {children}
    </Box>
  );
};
