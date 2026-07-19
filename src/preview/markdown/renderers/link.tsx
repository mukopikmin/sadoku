import { chakra } from "@chakra-ui/react";
import type { MarkdownComponentProps } from "../rendererTypes";

export const MarkdownLink = ({
  children,
  className,
  node: _node,
  ...props
}: MarkdownComponentProps<"a">) => {
  const isHeadingAnchor = className?.split(/\s+/).includes(
    "heading-anchor",
  ) ?? false;
  return (
    <chakra.a
      className={className}
      color={isHeadingAnchor ? "inherit" : "link"}
      textDecoration="none"
      _hover={isHeadingAnchor ? undefined : { textDecoration: "underline" }}
      {...props}
    >
      {children}
    </chakra.a>
  );
};
