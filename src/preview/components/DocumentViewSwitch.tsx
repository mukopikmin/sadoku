import { Badge, Box, Icon, Tabs } from "@chakra-ui/react";
import { BookOpen, MessagesSquare, TriangleAlert } from "lucide-react";
import type { PreviewView } from "../models/previewView";

type Props = {
  showLabels?: boolean;
  onChangeView: (view: PreviewView) => void;
  staleCommentCount: number;
  unresolvedCommentCount: number;
  view: PreviewView;
};

export const DocumentViewSwitch = ({
  showLabels = true,
  onChangeView,
  staleCommentCount,
  unresolvedCommentCount,
  view,
}: Props) => {
  return (
    <Tabs.Root
      minW="0"
      maxW="full"
      onValueChange={({ value }) => onChangeView(value as PreviewView)}
      size="sm"
      variant="line"
      colorPalette="blue"
      value={view}
    >
      <Tabs.List aria-label="Preview views" flexWrap="wrap" maxW="full" gap="1">
        <Tabs.Trigger
          aria-label="Preview"
          value="preview"
          maxW="full"
          h="auto"
          minH="9"
          flexWrap="wrap"
        >
          <Icon as={BookOpen} size="sm" aria-hidden="true" />
          {showLabels && "Preview"}
        </Tabs.Trigger>
        <Tabs.Trigger
          aria-label={`Comments, ${unresolvedCommentCount} unresolved`}
          value="comments"
          maxW="full"
          h="auto"
          minH="9"
          flexWrap="wrap"
        >
          <Icon as={MessagesSquare} size="sm" aria-hidden="true" />
          {showLabels && "Comments"}
          {unresolvedCommentCount > 0 && (
            <Badge aria-hidden="true" size="sm" variant="solid">
              {unresolvedCommentCount}
            </Badge>
          )}
          {staleCommentCount > 0 && (
            <Box
              as="span"
              aria-label={`Stale comments: ${staleCommentCount}`}
              color="warning.fg"
              display="inline-flex"
              role="img"
            >
              <Icon as={TriangleAlert} aria-hidden="true" size="xs" />
            </Box>
          )}
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content display="none" value={view} />
    </Tabs.Root>
  );
};
