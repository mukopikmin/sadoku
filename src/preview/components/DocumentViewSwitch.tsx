import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  type ButtonProps,
  Icon,
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

type ViewButtonProps = ButtonProps & {
  triggerId: string;
  tooltip: string;
  value: PreviewView;
};

// Forward group attributes to the button instead of the tooltip root.
const ViewButton = ({
  triggerId,
  tooltip,
  value,
  ...buttonProps
}: ViewButtonProps) => (
  <Tooltip content={tooltip} ids={{ trigger: triggerId }}>
    <Tabs.Trigger asChild value={value}>
      <Button
        {...buttonProps}
        _selected={{
          bg: "bg.emphasized",
          borderColor: "accent",
          color: "accent",
          zIndex: 1,
        }}
      />
    </Tabs.Trigger>
  </Tooltip>
);

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
          <ViewButton
            aria-label="Preview"
            px="0"
            tooltip="Preview"
            triggerId={triggerId("preview")}
            value="preview"
          >
            <BookOpen aria-hidden="true" />
          </ViewButton>
          <ViewButton
            aria-label={`Comments, ${unresolvedCommentCount} unresolved`}
            px={unresolvedCommentCount === 0 && staleCommentCount === 0
              ? "0"
              : undefined}
            tooltip={`Comments, ${unresolvedCommentCount} unresolved${
              staleCommentCount > 0 ? `, ${staleCommentCount} stale` : ""
            }`}
            triggerId={triggerId("comments")}
            value="comments"
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
          </ViewButton>
        </ButtonGroup>
      </Tabs.List>
      <Tabs.Content display="none" value={view} />
    </Tabs.Root>
  );
};
