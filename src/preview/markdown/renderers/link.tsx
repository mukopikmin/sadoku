import { Link } from "@chakra-ui/react";
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
    <Link
      className={className}
      color={isHeadingAnchor ? "inherit" : "link"}
      rel={isHeadingAnchor ? undefined : "noopener noreferrer"}
      target={isHeadingAnchor ? undefined : "_blank"}
      textDecoration="none"
      _hover={isHeadingAnchor ? undefined : { textDecoration: "underline" }}
      {...props}
    >
      {children}
    </Link>
  );
};
