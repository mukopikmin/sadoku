import { Code } from "@chakra-ui/react";
import type { MarkdownComponentProps } from "../rendererTypes";

export const MarkdownCode = ({
  children,
  className,
  node: _node,
  ...props
}: MarkdownComponentProps<"code">) => {
  return (
    <Code
      className={className}
      borderRadius="sm"
      px="0.4em"
      py="0.2em"
      bg="code.bg"
      color="fg"
      fontFamily="mono"
      fontSize="0.8em"
      {...props}
    >
      {children}
    </Code>
  );
};
