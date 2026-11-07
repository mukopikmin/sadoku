import { Box, Flex, IconButton, Link, Menu, Portal } from "@chakra-ui/react";
import { Ellipsis } from "lucide-react";
import { useCommentMenu } from "./useCommentMenu";
import type { Comment, GitHubCommentExport } from "../../models/comment";
import { ConfirmDialog } from "../ConfirmDialog";
import type {
  ReportCommentActionError,
  RunCommentAction,
} from "./useCommentActionState";

export type CommentActionMenuProps = {
  comment: Comment;
  disabled: boolean;
  lineLabel: string;
  onDelete: (id: number) => Promise<void>;
  onExport?: (id: number) => Promise<GitHubCommentExport>;
  onEdit: () => void;
  reportError: ReportCommentActionError;
  runAction: RunCommentAction;
};

export const CommentActionMenu = ({
  comment,
  disabled,
  lineLabel,
  onDelete,
  onExport,
  onEdit,
  reportError,
  runAction,
}: CommentActionMenuProps) => {
  const menu = useCommentMenu({
    comment,
    disabled,
    lineLabel,
    onDelete,
    onExport,
    onEdit,
    reportError,
    runAction,
  });
  const exportResult =
    menu.exportState.status === "exported"
      ? menu.exportState.result
      : undefined;

  return (
    <>
      <Flex position="absolute" right="0" top="0">
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              aria-label="More actions"
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
                <Box color="fg.muted" fontSize="xs" px="2" py="1">
                  {lineLabel}
                </Box>
                <Menu.Separator />
                <Menu.Item
                  value="copy"
                  disabled={disabled}
                  onClick={() => void menu.copy()}
                >
                  Copy comment
                </Menu.Item>
                {onExport &&
                  comment.author.type === "human" &&
                  comment.state === "active" && (
                    <Menu.Item
                      value="github"
                      disabled={disabled}
                      onClick={() => void menu.exportToGitHub()}
                    >
                      Save to GitHub review
                    </Menu.Item>
                  )}
                <Menu.Item value="edit" disabled={disabled} onClick={onEdit}>
                  Edit
                </Menu.Item>
                <Menu.Item
                  value="delete"
                  disabled={disabled}
                  onClick={() => menu.setDeleteOpen(true)}
                >
                  Delete
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </Flex>
      {exportResult && (
        <Link
          href={exportResult.url}
          target="_blank"
          rel="noopener noreferrer"
          fontSize="sm"
        >
          {exportResult.state === "pending"
            ? "View pending GitHub review"
            : "Already submitted — view on GitHub"}
        </Link>
      )}
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete"
        isPending={disabled}
        onConfirm={() => void menu.remove()}
        onOpenChange={menu.setDeleteOpen}
        open={menu.state.status === "confirming-delete"}
        title="Delete comment?"
      >
        This action cannot be undone.
      </ConfirmDialog>
    </>
  );
};
