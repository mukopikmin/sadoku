import { List } from "@chakra-ui/react";
import type { MarkdownComponentProps } from "../rendererTypes";

export const MarkdownListItem = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"li">) => <List.Item {...props}>{children}
</List.Item>;
