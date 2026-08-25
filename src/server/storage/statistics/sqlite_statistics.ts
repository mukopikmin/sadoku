import type { AppDatabaseConnection } from "../../db/connection.ts";
import type {
  DatabaseStatistics,
  StatisticsReader,
} from "../../usecase/statistics/get_statistics.ts";

type CountRow = {
  bot_count: number;
  document_count: number;
  human_count: number;
};

export const createSqliteStatisticsReader = (
  database: AppDatabaseConnection,
): StatisticsReader => ({
  async read(): Promise<DatabaseStatistics> {
    const row = (await database.execute<CountRow>(
      `SELECT
        (SELECT COUNT(*) FROM comment_document) AS document_count,
        (SELECT COUNT(*) FROM comment WHERE author_type = 'human') AS human_count,
        (SELECT COUNT(*) FROM comment WHERE author_type = 'bot') AS bot_count`,
    )).rows?.[0];
    if (row === undefined) {
      throw new Error("Failed to read database statistics.");
    }

    return {
      commentCount: { bot: row.bot_count, human: row.human_count },
      databaseSize: (await Deno.stat(database.path)).size,
      documentCount: row.document_count,
    };
  },
});
