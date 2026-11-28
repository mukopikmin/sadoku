import {
  CloseButton,
  Dialog,
  Flex,
  Portal,
  Spinner,
  Text,
} from "@chakra-ui/react";
import type { RefObject } from "react";
import type { DatabaseStatistics } from "../api/statistics";
import { useStatisticsQuery } from "../hooks/useStatistics";

const formatSize = (bytes: number | undefined): string => {
  if (bytes === undefined) return "Unavailable";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
};

const formatCount = (value: number) => value.toLocaleString();

const formatCountByAuthor = ({
  total,
  human,
  bot,
}: DatabaseStatistics["commentCount"]) =>
  `${formatCount(total)} (Human ${formatCount(human)} · Bot ${formatCount(bot)})`;

const formatResolutionRate = (resolved: number, total: number): string => {
  if (total === 0) return "—";
  const rate = (resolved / total).toLocaleString(undefined, {
    style: "percent",
  });
  return `${rate} (${formatCount(resolved)} of ${formatCount(total)} resolved)`;
};

const StatisticsRows = ({ rows }: { rows: [string, string][] }) => (
  <Flex as="dl" direction="column" gap="3">
    {rows.map(([label, value]) => (
      <Flex
        justifyContent="space-between"
        alignItems="baseline"
        gap="4"
        key={label}
      >
        <Text as="dt" color="fg.muted">
          {label}
        </Text>
        <Text
          as="dd"
          minW="0"
          overflowWrap="anywhere"
          textAlign="end"
          fontWeight="semibold"
        >
          {value}
        </Text>
      </Flex>
    ))}
  </Flex>
);

const StatisticsContent = ({
  commentCount,
  databaseSize,
  documentCount,
  details,
}: DatabaseStatistics) => {
  const documents: [string, string] = [
    "Registered documents",
    formatCount(documentCount),
  ];
  const threads: [string, string] = [
    "Comment threads",
    formatCountByAuthor(commentCount),
  ];
  const size: [string, string] = [
    "Database file size",
    formatSize(databaseSize),
  ];
  if (!details) {
    return <StatisticsRows rows={[documents, threads, size]} />;
  }
  return (
    <StatisticsRows
      rows={[
        documents,
        [
          "Documents with comments",
          formatCount(details.documentsWithCommentsCount),
        ],
        [
          "Documents with unresolved threads",
          formatCount(details.documentsWithUnresolvedThreadsCount),
        ],
        threads,
        [
          "Resolution rate",
          formatResolutionRate(details.resolvedThreadCount, commentCount.total),
        ],
        ["Replies", formatCountByAuthor(details.replyCount)],
        ["Saved revisions", formatCount(details.revisionCount)],
        size,
      ]}
    />
  );
};

export const StatisticsDialog = ({
  finalFocusRef,
  onOpenChange,
  open,
}: {
  finalFocusRef?: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const statistics = useStatisticsQuery(open);
  return (
    <Dialog.Root
      finalFocusEl={() => finalFocusRef?.current ?? null}
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Database statistics</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton aria-label="Close database statistics" size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body pb="6">
              {statistics.isPending ? (
                <Spinner aria-label="Loading database statistics" />
              ) : statistics.error ? (
                <Text color="fg.error">{statistics.error.message}</Text>
              ) : (
                <StatisticsContent {...statistics.data} />
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
