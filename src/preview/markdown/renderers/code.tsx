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
      px="1.5"
      py="0.5"
      bg="code.bg"
      color="fg"
      fontFamily="mono"
      fontSize="sm"
      {...props}
    >
      {children}
    </Code>
  );
};
