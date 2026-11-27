import {
  Box,
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

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
};

const formatCount = (value: number) => value.toLocaleString();

const formatAuthors = ({ human, bot }: DatabaseStatistics["commentCount"]) =>
  `${formatCount(human)} human · ${formatCount(bot)} bot`;

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
  const rows: [string, string][] = [
    ["Registered documents", formatCount(documentCount)],
    ["Comment threads", formatCount(commentCount.total)],
    ["Thread authors", formatAuthors(commentCount)],
  ];
  if (details) {
    rows.push(
      [
        "Thread status",
        `${formatCount(details.unresolvedThreadCount)} unresolved · ${formatCount(details.resolvedThreadCount)} resolved`,
      ],
      ["Replies", formatCount(details.replyCount.total)],
      ["Saved revisions", formatCount(details.revisionCount)],
    );
  }
  rows.push(["Database file size", formatSize(databaseSize)]);
  return (
    <Flex direction="column" gap="4">
      <StatisticsRows rows={rows} />
      {details && (
        <Box as="details">
          <Box as="summary" cursor="pointer" fontWeight="semibold">
            Details
          </Box>
          <Box mt="3">
            <StatisticsRows
              rows={[
                ["Tagged documents", formatCount(details.taggedDocumentCount)],
                ["Stale threads", formatCount(details.staleThreadCount)],
                ["Reply authors", formatAuthors(details.replyCount)],
                [
                  "Documents with revisions",
                  formatCount(details.documentsWithRevisionsCount),
                ],
                [
                  "Latest revision",
                  details.revisionCount === 0
                    ? "No revisions yet"
                    : formatDate(details.lastRevisionAt),
                ],
                ["Tags", formatCount(details.tagCount)],
                ["Memories", formatCount(details.memoryCount)],
                [
                  "Document instructions",
                  formatCount(details.documentInstructionCount),
                ],
                [
                  "Global instructions",
                  formatCount(details.globalInstructionCount),
                ],
                ["Reusable page space", formatSize(details.reusablePageBytes)],
                ["Database path", details.databasePath || "Unavailable"],
                ["SQLite version", details.sqliteVersion || "Unavailable"],
                [
                  "Latest migration",
                  details.lastMigrationVersion || "Unavailable",
                ],
                ["Migration applied at", formatDate(details.lastMigrationAt)],
              ]}
            />
          </Box>
        </Box>
      )}
    </Flex>
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
