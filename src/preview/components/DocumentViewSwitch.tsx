import { Badge, Box, Button, ButtonGroup, Icon, Tabs } from "@chakra-ui/react";
import { TriangleAlert } from "lucide-react";
import type { PreviewView } from "../models/previewView";
import { Tooltip } from "./ui/tooltip";

type Props = {
  onChangeView: (view: PreviewView) => void;
  staleCommentCount: number;
  unresolvedCommentCount: number;
  view: PreviewView;
};

export const DocumentViewSwitch = ({
  onChangeView,
  staleCommentCount,
  unresolvedCommentCount,
  view,
}: Props) => (
  <Tabs.Root
    flexShrink="0"
    onValueChange={({ value }) => onChangeView(value as PreviewView)}
    unstyled
    value={view}
  >
    <Tabs.List aria-label="Preview views" asChild>
      <ButtonGroup attached size="sm" variant="outline">
        <Tabs.Trigger asChild value="preview">
          <Button _selected={{ bg: "canvas.subtle", color: "fg" }}>
            Preview
          </Button>
        </Tabs.Trigger>
        <Tabs.Trigger
          aria-label={`Comments, ${unresolvedCommentCount} unresolved`}
          asChild
          value="comments"
        >
          <Button _selected={{ bg: "canvas.subtle", color: "fg" }}>
            Comments
            {unresolvedCommentCount > 0 && (
              <Badge aria-hidden="true" size="sm" variant="solid">
                {unresolvedCommentCount}
              </Badge>
            )}
            {staleCommentCount > 0 && (
              <Tooltip content={`Stale comments: ${staleCommentCount}`}>
                <Box
                  as="span"
                  aria-label={`Stale comments: ${staleCommentCount}`}
                  color="warning.fg"
                  display="inline-flex"
                  role="img"
                >
                  <Icon as={TriangleAlert} aria-hidden="true" size="xs" />
                </Box>
              </Tooltip>
            )}
          </Button>
        </Tabs.Trigger>
      </ButtonGroup>
    </Tabs.List>
    <Tabs.Content display="none" value={view} />
  </Tabs.Root>
);
