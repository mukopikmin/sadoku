import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import { CommentItem } from "../../components/comments/CommentItem";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type {
  Comment,
  ResolvedComment,
  UnresolvedComment,
} from "../../models/comment";
import { isUnresolvedComment } from "../../models/comment";
import { useCommentActions, useCommentsQuery } from "../../hooks/useComments";
import { useCommentBulkActions } from "./useCommentBulkActions";

export type CommentListProps = {
  actions: CommentActions;
  comments: Comment[];
};

type CommentDisplayCategory = "unresolved" | "resolved";

const formatRange = (line: number, endLine = line): string =>
  line === endLine ? `Line ${line}` : `Lines ${line}-${endLine}`;

const formatOriginalRange = (comment: Comment): string =>
  formatRange(
    comment.originalStartLine,
    comment.originalEndLine,
  );

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
    {comments.length === 0
      ? <Text color="fg.muted">{emptyText}</Text>
      : (
        <Stack gap="3">
          {comments.map((comment) => (
            <Flex align="start" gap="3" key={comment.id}>
              <Checkbox.Root
                checked={bulk.selectedIds.includes(comment.id)}
                disabled={bulk.isPending}
                mt="3"
                onCheckedChange={() =>
                  bulk.toggle(comment.id)}
              >
                <Checkbox.HiddenInput
                  aria-label={`Select comment ${comment.id}: ${
                    formatLineLabel(comment)
                  }`}
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

export const CommentList = ({
  actions,
  comments,
}: CommentListProps) => {
  const [selectedCategory, setSelectedCategory] = useState<
    CommentDisplayCategory
  >(
    "unresolved",
  );
  const unresolvedComments = comments.filter(isUnresolvedComment);
  const resolvedComments = comments.filter(
    (comment): comment is ResolvedComment => comment.state === "resolved",
  );
  const sections: Record<
    CommentDisplayCategory,
    {
      comments: UnresolvedComment[] | ResolvedComment[];
      emptyText: string;
      label: string;
    }
  > = {
    unresolved: {
      comments: unresolvedComments,
      emptyText: "No unresolved comments.",
      label: "Unresolved",
    },
    resolved: {
      comments: resolvedComments,
      emptyText: "No resolved comments.",
      label: "Resolved",
    },
  };
  const categories = Object.keys(sections) as CommentDisplayCategory[];
  const selectedSection = sections[selectedCategory];
  const bulk = useCommentBulkActions(selectedSection.comments, actions);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const selectCategory = (category: CommentDisplayCategory) => {
    if (bulk.isPending || isDeleteDialogOpen) return;
    if (category === selectedCategory) return;
    bulk.clearSelection();
    setSelectedCategory(category);
  };
  const selectAdjacentCategory = (
    category: CommentDisplayCategory,
    direction: -1 | 1,
    tabList: HTMLElement,
  ) => {
    const index = categories.indexOf(category);
    const nextCategory = categories[
      (index + direction + categories.length) % categories.length
    ];
    selectCategory(nextCategory);
    tabList.querySelector<HTMLElement>(`[data-value="${nextCategory}"]`)
      ?.focus();
  };

  return (
    <Tabs.Root
      onValueChange={({ value }) =>
        selectCategory(value as CommentDisplayCategory)}
      value={selectedCategory}
      variant="line"
    >
      <Tabs.List mb="7">
        {categories.map((category) => (
          <Tabs.Trigger
            key={category}
            disabled={bulk.isPending || isDeleteDialogOpen}
            onClick={() => selectCategory(category)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
              }
              event.preventDefault();
              selectAdjacentCategory(
                category,
                event.key === "ArrowLeft" ? -1 : 1,
                event.currentTarget.parentElement!,
              );
            }}
            value={category}
          >
            {sections[category].label}
            <Badge aria-hidden="true" size="sm" variant="solid">
              {sections[category].comments.length}
            </Badge>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={selectedCategory}>
        <CommentSection
          actions={actions}
          bulk={bulk}
          comments={selectedSection.comments}
          emptyText={selectedSection.emptyText}
        >
          {selectedSection.comments.length > 0 && (
            <Flex
              align="center"
              aria-label="Bulk comment actions"
              gap="3"
              mb="4"
              role="group"
              wrap="wrap"
            >
              <Checkbox.Root
                checked={bulk.selectedIds.length ===
                    selectedSection.comments.length
                  ? true
                  : bulk.selectedIds.length > 0
                  ? "indeterminate"
                  : false}
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
              <Button
                colorPalette={selectedCategory === "resolved" ? "gray" : "green"}
                disabled={bulk.isPending || bulk.selectedIds.length === 0}
                loading={bulk.state.status === "pending" &&
                  bulk.state.operation !== "delete"}
                loadingText={selectedCategory === "resolved"
                  ? "Reopening…"
                  : "Resolving…"}
                onClick={() =>
                  void bulk.run(
                    selectedCategory === "resolved" ? "reopen" : "resolve",
                  )}
                size="sm"
                variant="outline"
              >
                {selectedCategory === "resolved"
                  ? <RotateCcw aria-hidden="true" />
                  : <Check aria-hidden="true" />}
                {selectedCategory === "resolved" ? "Reopen" : "Resolve"}
              </Button>
              <Button
                colorPalette="red"
                disabled={bulk.isPending || bulk.selectedIds.length === 0}
                onClick={() =>
                  setIsDeleteDialogOpen(true)}
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
      </Tabs.Content>
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete"
        isPending={bulk.isPending}
        onConfirm={async () => {
          await bulk.run("delete");
          setIsDeleteDialogOpen(false);
        }}
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
        title="Delete selected comments?"
      >
        Delete {bulk.selectedIds.length}{" "}
        selected comments and their replies? This action cannot be undone.
      </ConfirmDialog>
    </Tabs.Root>
  );
};

export const CommentListPage = ({ documentId, documentDeleted = false }: {
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
      comments={documentDeleted
        ? commentsQuery.data.comments.map((comment) => ({
          ...comment,
          currentSource: { state: "deleted" as const },
        }))
        : commentsQuery.data.comments}
    />
  );
};
