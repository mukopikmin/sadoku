import { Box } from "@chakra-ui/react";
import type { MarkdownComponentProps } from "../rendererTypes";

export const MarkdownImage = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"img">) => (
  <Box as="img" maxW="100%" h="auto" {...props} />
);
