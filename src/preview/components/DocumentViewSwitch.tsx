import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Icon,
  IconButton,
  Tabs,
} from "@chakra-ui/react";
import { BookOpen, MessagesSquare, TriangleAlert } from "lucide-react";
import { useId } from "react";
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
}: Props) => {
  const id = useId();
  // Tooltips and tabs share trigger IDs to preserve keyboard navigation.
  const triggerId = (value: string) => `${id}-${value}`;
  return (
    <Tabs.Root
      flexShrink="0"
      ids={{ trigger: triggerId }}
      onValueChange={({ value }) => onChangeView(value as PreviewView)}
      unstyled
      value={view}
    >
      <Tabs.List aria-label="Preview views" asChild>
        <ButtonGroup attached size="sm" variant="outline">
          <Tooltip content="Preview" ids={{ trigger: triggerId("preview") }}>
            <Tabs.Trigger aria-label="Preview" asChild value="preview">
              <IconButton _selected={{ bg: "canvas.subtle", color: "fg" }}>
                <BookOpen aria-hidden="true" />
              </IconButton>
            </Tabs.Trigger>
          </Tooltip>
          <Tooltip
            ids={{ trigger: triggerId("comments") }}
            content={`Comments, ${unresolvedCommentCount} unresolved${
              staleCommentCount > 0 ? `, ${staleCommentCount} stale` : ""
            }`}
          >
            <Tabs.Trigger
              aria-label={`Comments, ${unresolvedCommentCount} unresolved`}
              asChild
              value="comments"
            >
              <Button
                _selected={{ bg: "canvas.subtle", color: "fg" }}
                px={unresolvedCommentCount === 0 && staleCommentCount === 0
                  ? "0"
                  : undefined}
              >
                <MessagesSquare aria-hidden="true" />
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
              </Button>
            </Tabs.Trigger>
          </Tooltip>
        </ButtonGroup>
      </Tabs.List>
      <Tabs.Content display="none" value={view} />
    </Tabs.Root>
  );
};
