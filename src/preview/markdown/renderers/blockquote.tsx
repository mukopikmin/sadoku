import { Box, HStack } from "@chakra-ui/react";
import {
  CircleAlert,
  Info,
  Lightbulb,
  MessageSquareWarning,
  TriangleAlert,
} from "lucide-react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

const alertStyles = {
  NOTE: { title: "Note", palette: "blue", icon: Info },
  TIP: { title: "Tip", palette: "green", icon: Lightbulb },
  IMPORTANT: {
    title: "Important",
    palette: "purple",
    icon: MessageSquareWarning,
  },
  WARNING: { title: "Warning", palette: "yellow", icon: TriangleAlert },
  CAUTION: { title: "Caution", palette: "red", icon: CircleAlert },
};

const isAlertType = (value: string): value is keyof typeof alertStyles =>
  Object.hasOwn(alertStyles, value);

export const renderMarkdownBlockquote = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => {
  const kind = elementProps["data-markdown-alert"];
  const alert = kind && isAlertType(kind) ? alertStyles[kind] : undefined;
  const Icon = alert?.icon;
  return (
    <Box
      as="blockquote"
      colorPalette={alert?.palette}
      borderColor={alert ? "colorPalette.fg" : "border.default"}
      borderLeftWidth="4px"
      color={alert ? "fg" : "fg.muted"}
      m="0"
      pl="4"
      py="2"
      {...elementProps}
    >
      {alert && Icon && (
        <HStack color="colorPalette.fg" fontWeight="semibold" gap="2" pb="2">
          <Icon aria-hidden="true" size="1em" />
          {alert.title}
        </HStack>
      )}
      {children}
    </Box>
  );
};

export const MarkdownBlockquote = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"blockquote">) =>
  renderMarkdownBlockquote(props, children);
