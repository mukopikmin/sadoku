import { Badge, Box, Heading, Stack, Tabs, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import { CommentItem } from "../../components/comments/CommentItem";
import type {
  Comment,
  ResolvedComment,
  UnresolvedComment,
} from "../../models/comment";
import { isUnresolvedComment } from "../../models/comment";
import { useCommentActions, useCommentsQuery } from "../../hooks/useComments";

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

type CommentSectionProps<T extends Comment> = {
  actions: CommentActions;
  comments: T[];
  emptyText: string;
  title: string;
};

const CommentSection = <T extends Comment>({
  actions,
  comments,
  emptyText,
  title,
}: CommentSectionProps<T>) => (
  <Box as="section">
    <Heading as="h2" size="xl" mt="0" mb="4">{title}</Heading>
    {comments.length === 0
      ? <Text color="fg.muted">{emptyText}</Text>
      : (
        <Stack gap="3">
          {comments.map((comment) => (
            <CommentItem
              actions={actions}
              variant="panel"
              comment={comment}
              key={comment.id}
              lineLabel={formatLineLabel(comment)}
              showSource
              showState
            />
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
  const selectCategory = (category: CommentDisplayCategory) =>
    setSelectedCategory(category);
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
          comments={selectedSection.comments}
          emptyText={selectedSection.emptyText}
          title={`${selectedSection.label} comments`}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
};

export const CommentListPage = ({ documentId }: { documentId?: number }) => {
  const commentsQuery = useCommentsQuery(documentId);
  const actions = useCommentActions(documentId);
  if (!commentsQuery.data) return null;
  return (
    <CommentList actions={actions} comments={commentsQuery.data.comments} />
  );
};
