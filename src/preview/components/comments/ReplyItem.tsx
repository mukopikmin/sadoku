import {
  Badge,
  Box,
  Flex,
  Icon,
  IconButton,
  Menu,
  Portal,
  Stack,
} from "@chakra-ui/react";
import { CornerDownRight, Ellipsis } from "lucide-react";
import { useReplyItem } from "./useReplyItem";
import { ConfirmDialog } from "../ConfirmDialog";
import type { CommentReply } from "../../models/comment";
import { CommentForm } from "./CommentForm";
import { CommentMarkdown } from "./CommentMarkdown";
import type {
  ReportCommentActionError,
  RunCommentAction,
} from "./useCommentActionState";

export type ReplyItemProps = {
  commentId: number;
  disabled: boolean;
  onDelete: (commentId: number, replyId: number) => Promise<void>;
  onUpdate: (commentId: number, replyId: number, body: string) => Promise<void>;
  reportError: ReportCommentActionError;
  reply: CommentReply;
  sourceText?: string;
  runAction: RunCommentAction;
};

export const ReplyItem = ({
  commentId,
  disabled,
  onDelete,
  onUpdate,
  reportError,
  reply,
  sourceText,
  runAction,
}: ReplyItemProps) => {
  const item = useReplyItem({
    commentId,
    disabled,
    onDelete,
    onUpdate,
    reportError,
    reply,
    runAction,
  });
  const { state } = item;
  const isEditing =
    state.status === "editing" ||
    state.status === "saving" ||
    state.status === "error";

  return (
    <Stack
      aria-label="Reply"
      as="article"
      borderLeftColor="border.default"
      borderLeftWidth="2px"
      className="comment-reply"
      gap="2"
      minW="0"
      ml="6"
      pl="2"
      pr="1"
      position="relative"
      py="1"
    >
      <Icon
        asChild
        boxSize="1em"
        color="border.default"
        fontSize="comment"
        left="-6"
        position="absolute"
        top="2"
      >
        <CornerDownRight aria-hidden="true" />
      </Icon>
      {reply.author.type === "bot" && (
        <Flex
          align="center"
          gap="2"
          color="fg.muted"
          fontSize="xs"
          fontWeight="semibold"
          pr="8"
        >
          <Badge colorPalette="purple" variant="subtle">
            Bot
          </Badge>
          {reply.reviewRequested && (
            <Badge colorPalette="blue" variant="subtle">
              Review requested
            </Badge>
          )}
        </Flex>
      )}
      {!isEditing && (
        <Flex position="absolute" right="0" top="0">
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                aria-label="More actions for reply"
                disabled={disabled}
                size="xs"
                variant="ghost"
              >
                <Ellipsis aria-hidden="true" />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item
                    value="copy"
                    disabled={disabled}
                    onClick={() => void item.copy()}
                  >
                    Copy reply
                  </Menu.Item>
                  <Menu.Item value="edit" onClick={() => item.edit()}>
                    Edit
                  </Menu.Item>
                  <Menu.Item
                    value="delete"
                    onClick={() => item.setDeleteOpen(true)}
                  >
                    Delete
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </Flex>
      )}
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete"
        isPending={disabled}
        onConfirm={item.confirmDelete}
        onOpenChange={item.setDeleteOpen}
        open={state.status === "confirming-delete"}
        title="Delete reply?"
      >
        This action cannot be undone.
      </ConfirmDialog>
      {isEditing ? (
        <CommentForm
          cancelAriaLabel="Cancel reply edit"
          disabled={disabled}
          onCancel={item.cancelEdit}
          onChange={item.change}
          onSubmit={() => void item.save()}
          submitAriaLabel="Save reply"
          submitLabel="Save"
          textareaAriaLabel="Edit reply body"
          value={"draft" in state ? state.draft : ""}
        />
      ) : (
        <Box pr="8">
          <CommentMarkdown sourceText={sourceText}>
            {reply.body}
          </CommentMarkdown>
        </Box>
      )}
    </Stack>
  );
};
