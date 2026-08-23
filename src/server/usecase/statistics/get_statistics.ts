export type DatabaseStatistics = {
  commentCount: { bot: number; human: number };
  databaseSize: number;
  documentCount: number;
};

export type StatisticsReader = {
  read: () => Promise<DatabaseStatistics>;
};

export const getStatistics = (
  reader: StatisticsReader,
): Promise<DatabaseStatistics> => reader.read();
