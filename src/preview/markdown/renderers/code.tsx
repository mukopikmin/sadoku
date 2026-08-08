import { Code } from "@chakra-ui/react";
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
    <Code
      className={isCodeBlock
        ? [className, "markdown-code-block"].filter(Boolean).join(" ")
        : className}
      borderRadius={isCodeBlock ? "0" : "sm"}
      px={isCodeBlock ? "0" : "0.4em"}
      py={isCodeBlock ? "0" : "0.2em"}
      bg={isCodeBlock ? "transparent" : "code.bg"}
      color={isCodeBlock ? "code.fg" : "fg"}
      display={isCodeBlock ? "block" : undefined}
      fontFamily="mono"
      fontSize={isCodeBlock ? "0.8rem" : "0.8em"}
      {...props}
    >
      {children}
    </Code>
  );
};
