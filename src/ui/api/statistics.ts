import type {
  CommentCount,
  GetStatisticsResponse,
} from "../gen/sadoku/preview/v1/preview_pb";

export type DatabaseStatistics = {
  commentCount: { bot: number; human: number; total: number };
  databaseSize?: number;
  documentCount: number;
  details?: {
    unresolvedThreadCount: number;
    resolvedThreadCount: number;
    staleThreadCount: number;
    replyCount: DatabaseStatistics["commentCount"];
    revisionCount: number;
    documentsWithRevisionsCount: number;
    lastRevisionAt: string;
    taggedDocumentCount: number;
    tagCount: number;
    memoryCount: number;
    documentInstructionCount: number;
    globalInstructionCount: number;
    reusablePageBytes: number;
    databasePath: string;
    sqliteVersion: string;
    lastMigrationVersion: string;
    lastMigrationAt: string;
  };
};

const toSafeNumber = (value: bigint): number => {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Invalid statistics response.");
  }
  return Number(value);
};

const toCommentCount = ({ bot, human }: CommentCount) => ({
  bot: toSafeNumber(bot),
  human: toSafeNumber(human),
  total: toSafeNumber(bot + human),
});

export const toDatabaseStatistics = (
  response: GetStatisticsResponse,
): DatabaseStatistics => {
  if (!response.commentCount) {
    throw new Error("Invalid statistics response.");
  }
  const statistics: DatabaseStatistics = {
    commentCount: toCommentCount(response.commentCount),
    documentCount: toSafeNumber(response.documentCount),
  };
  if (response.databaseSize !== undefined) {
    statistics.databaseSize = toSafeNumber(response.databaseSize);
  }
  const details = response.details;
  if (details) {
    const resolvedThreadCount = toSafeNumber(details.resolvedThreadCount);
    const staleThreadCount = toSafeNumber(details.staleThreadCount);
    if (
      !details.replyCount ||
      resolvedThreadCount > statistics.commentCount.total ||
      staleThreadCount > statistics.commentCount.total
    ) {
      throw new Error("Invalid statistics response.");
    }
    statistics.details = {
      unresolvedThreadCount:
        statistics.commentCount.total - resolvedThreadCount,
      resolvedThreadCount,
      staleThreadCount,
      replyCount: toCommentCount(details.replyCount),
      revisionCount: toSafeNumber(details.revisionCount),
      documentsWithRevisionsCount: toSafeNumber(
        details.documentsWithRevisionsCount,
      ),
      lastRevisionAt: details.lastRevisionAt,
      taggedDocumentCount: toSafeNumber(details.taggedDocumentCount),
      tagCount: toSafeNumber(details.tagCount),
      memoryCount: toSafeNumber(details.memoryCount),
      documentInstructionCount: toSafeNumber(details.documentInstructionCount),
      globalInstructionCount: toSafeNumber(details.globalInstructionCount),
      reusablePageBytes: toSafeNumber(details.reusablePageBytes),
      databasePath: details.databasePath,
      sqliteVersion: details.sqliteVersion,
      lastMigrationVersion: details.lastMigrationVersion,
      lastMigrationAt: details.lastMigrationAt,
    };
  }
  return statistics;
};
