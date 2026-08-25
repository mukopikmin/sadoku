import { Dialog, Flex, Portal, Spinner, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { loadDatabaseStatistics } from "../api/statistics";

const formatSize = (bytes: number): string => {
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

export const StatisticsDialog = ({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const statistics = useQuery({
    enabled: open,
    queryFn: loadDatabaseStatistics,
    queryKey: ["database-statistics"],
    staleTime: 0,
  });
  return (
    <Dialog.Root
      finalFocusEl={() =>
        document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open database statistics"]',
        )}
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Database statistics</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb="6">
              {statistics.isPending
                ? <Spinner aria-label="Loading database statistics" />
                : statistics.error
                ? <Text color="fg.error">{statistics.error.message}</Text>
                : (
                  <Flex as="dl" direction="column" gap="3">
                    {[
                      [
                        "Documents",
                        statistics.data.documentCount.toLocaleString(),
                      ],
                      [
                        "Database size",
                        formatSize(statistics.data.databaseSize),
                      ],
                      [
                        "Human comments",
                        statistics.data.commentCount.human.toLocaleString(),
                      ],
                      [
                        "Bot comments",
                        statistics.data.commentCount.bot.toLocaleString(),
                      ],
                    ].map(([label, value]) => (
                      <Flex justifyContent="space-between" gap="6" key={label}>
                        <Text as="dt" color="fg.muted">{label}</Text>
                        <Text as="dd" fontWeight="semibold">{value}</Text>
                      </Flex>
                    ))}
                  </Flex>
                )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
