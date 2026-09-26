import { Box, Flex, IconButton, Link, Menu, Portal } from "@chakra-ui/react";
import { Copy, Ellipsis } from "lucide-react";
import { useState } from "react";
import type { Comment, GitHubCommentExport } from "../../models/comment";
import { ConfirmDialog } from "../ConfirmDialog";
import { toaster } from "../ui/toaster";
import type {
  ReportCommentActionError,
  RunCommentAction,
} from "./useCommentActionState";

type CommentActionMenuProps = {
  comment: Comment;
  disabled: boolean;
  lineLabel: string;
  onDelete: (id: number) => Promise<void>;
  onExport?: (id: number) => Promise<GitHubCommentExport>;
  onEdit: () => void;
  onReopen: (id: number) => Promise<void>;
  onResolve: (id: number) => Promise<void>;
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
  onReopen,
  onResolve,
  reportError,
  runAction,
}: CommentActionMenuProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [exportResult, setExportResult] = useState<GitHubCommentExport>();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(comment.body);
      toaster.create({
        closable: true,
        description: "The comment body was copied to the clipboard.",
        title: "Comment copied",
        type: "success",
      });
    } catch (error) {
      reportError(error, "Could not copy comment");
    }
  };

  const handleDelete = () =>
    runAction(() => onDelete(comment.id), {
      errorTitle: "Could not delete comment",
      onSuccess: () => setIsDeleteDialogOpen(false),
    });

  const handleReopen = () =>
    runAction(() => onReopen(comment.id), {
      errorTitle: "Could not reopen comment",
    });

  const handleResolve = () =>
    runAction(() => onResolve(comment.id), {
      errorTitle: "Could not resolve comment",
      onSuccess: () => {
        toaster.create({
          action: {
            label: "Undo",
            onClick: () => {
              void handleReopen();
            },
          },
          closable: true,
          description: "The comment was resolved.",
          title: "Comment resolved",
          type: "success",
        });
      },
    });

  return (
    <>
      <Flex position="absolute" right="0" top="0">
        <IconButton
          aria-label="Copy comment"
          disabled={disabled}
          onClick={handleCopy}
          size="xs"
          variant="ghost"
        >
          <Copy aria-hidden="true" />
        </IconButton>
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
                {onExport && comment.author.type === "human" &&
                  comment.state === "active" && (
                  <Menu.Item
                    value="github"
                    disabled={disabled}
                    onClick={() => {
                      void runAction(async () => {
                        setExportResult(await onExport(comment.id));
                      }, { errorTitle: "Could not save to GitHub review" });
                    }}
                  >
                    Save to GitHub review
                  </Menu.Item>
                )}
                <Menu.Item
                  value={comment.state === "resolved" ? "reopen" : "resolve"}
                  onClick={() => {
                    void (comment.state === "resolved"
                      ? handleReopen()
                      : handleResolve());
                  }}
                >
                  {comment.state === "resolved" ? "Reopen" : "Resolve"}
                </Menu.Item>
                <Menu.Item value="edit" onClick={onEdit}>
                  Edit
                </Menu.Item>
                <Menu.Item
                  value="delete"
                  onClick={() => setIsDeleteDialogOpen(true)}
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
        onConfirm={() => void handleDelete()}
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
        title="Delete comment?"
      >
        This action cannot be undone.
      </ConfirmDialog>
    </>
  );
};
