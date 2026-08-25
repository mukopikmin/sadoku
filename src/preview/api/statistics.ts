export type DatabaseStatistics = {
  commentCount: { bot: number; human: number };
  databaseSize: number;
  documentCount: number;
};

export const loadDatabaseStatistics = async (): Promise<DatabaseStatistics> => {
  const response = await fetch("/__sadoku/statistics");
  if (!response.ok) {
    throw new Error(`Failed to load database statistics: ${response.status}`);
  }
  return await response.json() as DatabaseStatistics;
};
