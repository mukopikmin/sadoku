import { Box, Separator } from "@chakra-ui/react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownHorizontalRule = (
  elementProps: Omit<MarkdownElementProps, "children">,
) => (
  <Box mt="6" mb="6">
    <Separator
      as="hr"
      borderColor="border.muted"
      m="0"
      {...elementProps}
    />
  </Box>
);

export const MarkdownHorizontalRule = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"hr">) => renderMarkdownHorizontalRule(props);
