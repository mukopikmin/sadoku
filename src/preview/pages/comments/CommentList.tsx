import { Box, Heading, Stack, Tabs, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import { CommentItem } from "../../components/comments/CommentItem";
import type {
  ActiveComment,
  Comment,
  ResolvedComment,
  StaleComment,
} from "../../models/comment";
import {
  useCommentActions,
  useCommentsQuery,
} from "../../hooks/usePreviewData";

export type CommentListProps = {
  actions: CommentActions;
  comments: Comment[];
};

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
  const [selectedState, setSelectedState] = useState<Comment["state"]>(
    "active",
  );
  const activeComments = comments.filter(
    (comment): comment is ActiveComment => comment.state === "active",
  );
  const staleComments = comments.filter(
    (comment): comment is StaleComment => comment.state === "stale",
  );
  const resolvedComments = comments.filter(
    (comment): comment is ResolvedComment => comment.state === "resolved",
  );
  const sections = {
    active: {
      comments: activeComments,
      emptyText: "No active comments.",
      label: "Active",
    },
    stale: {
      comments: staleComments,
      emptyText: "No stale comments.",
      label: "Stale",
    },
    resolved: {
      comments: resolvedComments,
      emptyText: "No resolved comments.",
      label: "Resolved",
    },
  };
  const selectedSection = sections[selectedState];
  const states = Object.keys(sections) as Comment["state"][];

  const selectAdjacentTab = (
    state: Comment["state"],
    direction: -1 | 1,
    tabList: HTMLElement,
  ) => {
    const index = states.indexOf(state);
    const nextState =
      states[(index + direction + states.length) % states.length];
    setSelectedState(nextState);
    tabList.querySelector<HTMLElement>(`[data-value="${nextState}"]`)
      ?.focus();
  };

  return (
    <Tabs.Root
      onValueChange={({ value }) => setSelectedState(value as Comment["state"])}
      value={selectedState}
      variant="enclosed"
    >
      <Tabs.List mb="7">
        {states.map((state) => (
          <Tabs.Trigger
            key={state}
            onClick={() => setSelectedState(state)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
              }
              event.preventDefault();
              selectAdjacentTab(
                state,
                event.key === "ArrowLeft" ? -1 : 1,
                event.currentTarget.parentElement!,
              );
            }}
            value={state}
          >
            {sections[state].label} ({sections[state].comments.length})
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={selectedState}>
        <CommentSection
          actions={actions}
          comments={selectedSection.comments}
          emptyText={selectedSection.emptyText}
          title={`${selectedSection.label} comments (${selectedSection.comments.length})`}
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
