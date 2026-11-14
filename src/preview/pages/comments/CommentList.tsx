import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import type { CommentActions } from "../../api/commentActions";
import { CommentItem } from "../../components/comments/CommentItem";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { Comment } from "../../models/comment";
import { useCommentActions, useCommentsQuery } from "../../hooks/useComments";
import { useCommentBulkActions } from "./useCommentBulkActions";
import { type CommentFilter } from "./useCommentFilter";

export type CommentListProps = {
  actions: CommentActions;
  comments: Comment[];
};

import { useCommentList } from "./useCommentList";

const formatRange = (line: number, endLine = line): string =>
  line === endLine ? `Line ${line}` : `Lines ${line}-${endLine}`;

const formatOriginalRange = (comment: Comment): string =>
  formatRange(comment.originalStartLine, comment.originalEndLine);

const formatLineLabel = (comment: Comment): string => {
  const current = formatRange(comment.startLine, comment.endLine);
  const original = formatOriginalRange(comment);
  if (comment.state === "stale") return `Originally ${original.toLowerCase()}`;
  if (
    comment.originalStartLine !== comment.startLine ||
    comment.originalEndLine !== comment.endLine
  ) {
    return `${current} (originally ${original.toLowerCase()})`;
  }
  return current;
};

type CommentSectionProps = {
  actions: CommentActions;
  children: ReactNode;
  comments: Comment[];
  bulk: ReturnType<typeof useCommentBulkActions>;
  emptyText: string;
};

const CommentSection = ({
  actions,
  children,
  comments,
  bulk,
  emptyText,
}: CommentSectionProps) => (
  <Box as="section">
    {children}
    {comments.length === 0 ? (
      <Text color="fg.muted">{emptyText}</Text>
    ) : (
      <Stack gap="3">
        {comments.map((comment) => (
          <Flex align="start" gap="3" key={comment.id}>
            <Checkbox.Root
              checked={bulk.selectedIds.includes(comment.id)}
              disabled={bulk.isPending}
              mt="3"
              onCheckedChange={() => bulk.toggle(comment.id)}
            >
              <Checkbox.HiddenInput
                aria-label={`Select comment ${comment.id}: ${formatLineLabel(
                  comment,
                )}`}
              />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Root>
            <Box flex="1" minW="0">
              <CommentItem
                actions={actions}
                variant="card"
                comment={comment}
                disabled={bulk.isPending}
                lineLabel={formatLineLabel(comment)}
                showSource
                showState
              />
            </Box>
          </Flex>
        ))}
      </Stack>
    )}
  </Box>
);

export const CommentList = ({ actions, comments }: CommentListProps) => {
  const list = useCommentList(comments, actions);
  const { commentFilter, bulk, selectFilter } = list;
  const isDeleteDialogOpen = list.deletion.status !== "closed";

  return (
    <Stack gap="4">
      <Stack gap="2">
        <Flex aria-label="Comment filters" role="group" gap="4" wrap="wrap">
          {(Object.keys(commentFilter.filters) as CommentFilter[]).map(
            (filter) => (
              <Checkbox.Root
                key={filter}
                checked={commentFilter.selectedFilters.includes(filter)}
                disabled={bulk.isPending || isDeleteDialogOpen}
                onCheckedChange={() => selectFilter(filter)}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label>
                  {commentFilter.filters[filter].label}
                </Checkbox.Label>
                <Badge aria-hidden="true" size="sm" variant="solid">
                  {commentFilter.filters[filter].comments.length}
                </Badge>
              </Checkbox.Root>
            ),
          )}
        </Flex>
        <Text color="fg.muted" fontSize="sm" aria-live="polite">
          Showing {commentFilter.visibleComments.length} of{" "}
          {commentFilter.totalCount} comments
        </Text>
      </Stack>
      <CommentSection
        actions={actions}
        bulk={bulk}
        comments={commentFilter.visibleComments}
        emptyText={commentFilter.emptyText}
      >
        {commentFilter.visibleComments.length > 0 && (
          <Flex
            align="center"
            aria-label="Bulk comment actions"
            gap="3"
            mb="4"
            role="group"
            wrap="wrap"
          >
            <Checkbox.Root
              checked={
                bulk.selectedIds.length === commentFilter.visibleComments.length
                  ? true
                  : bulk.selectedIds.length > 0
                    ? "indeterminate"
                    : false
              }
              disabled={bulk.isPending}
              onCheckedChange={bulk.toggleAll}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>Select all</Checkbox.Label>
            </Checkbox.Root>
            <Text role="status" color="fg.muted" fontSize="sm">
              {bulk.selectedIds.length} selected
            </Text>
            {(["resolve", "reopen"] as const)
              .filter((operation) =>
                operation === "resolve"
                  ? commentFilter.selectedFilters.some(
                      (filter) => filter !== "resolved",
                    )
                  : commentFilter.selectedFilters.includes("resolved"),
              )
              .map((operation) => (
                <Button
                  key={operation}
                  colorPalette={operation === "resolve" ? "green" : "gray"}
                  disabled={
                    bulk.isPending ||
                    !(operation === "resolve"
                      ? list.canResolve
                      : list.canReopen)
                  }
                  loading={
                    bulk.state.status === "pending" &&
                    bulk.state.operation === operation
                  }
                  loadingText={
                    operation === "resolve" ? "Resolving…" : "Reopening…"
                  }
                  onClick={() => void bulk.run(operation)}
                  size="sm"
                  variant="outline"
                >
                  {operation === "resolve" ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <RotateCcw aria-hidden="true" />
                  )}
                  {operation === "resolve" ? "Resolve" : "Reopen"}
                </Button>
              ))}
            <Button
              colorPalette="red"
              disabled={bulk.isPending || bulk.selectedIds.length === 0}
              onClick={() => list.setDeleteOpen(true)}
              size="sm"
              variant="outline"
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          </Flex>
        )}
        {bulk.state.status === "error" && (
          <Text role="alert" color="fg.error" mb="4">
            {bulk.state.message}
          </Text>
        )}
      </CommentSection>
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete"
        isPending={bulk.isPending}
        onConfirm={list.confirmDelete}
        onOpenChange={list.setDeleteOpen}
        open={isDeleteDialogOpen}
        title="Delete selected comments?"
      >
        Delete {bulk.selectedIds.length} selected comments and their replies?
        This action cannot be undone.
      </ConfirmDialog>
    </Stack>
  );
};

export const CommentListPage = ({
  documentId,
  documentDeleted = false,
}: {
  documentId?: number;
  documentDeleted?: boolean;
}) => {
  const commentsQuery = useCommentsQuery(documentId);
  const actions = useCommentActions(documentId);
  if (!commentsQuery.data) return null;
  return (
    <CommentList
      key={documentId}
      actions={actions}
      comments={
        documentDeleted
          ? commentsQuery.data.comments.map((comment) => ({
              ...comment,
              currentSource: { state: "deleted" as const },
            }))
          : commentsQuery.data.comments
      }
    />
  );
};
