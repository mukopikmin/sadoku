import type {
  CommentCount,
  GetStatisticsResponse,
} from "../gen/sadoku/preview/v1/preview_pb";

export type DatabaseStatistics = {
  commentCount: { bot: number; human: number; total: number };
  databaseSize?: number;
  documentCount: number;
  details?: {
    documentsWithCommentsCount: number;
    documentsWithUnresolvedThreadsCount: number;
    resolvedThreadCount: number;
    replyCount: DatabaseStatistics["commentCount"];
    revisionCount: number;
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
    const documentsWithCommentsCount = toSafeNumber(
      details.documentsWithCommentsCount,
    );
    const documentsWithUnresolvedThreadsCount = toSafeNumber(
      details.documentsWithUnresolvedThreadsCount,
    );
    const total = statistics.commentCount.total;
    if (
      !details.replyCount ||
      resolvedThreadCount > total ||
      documentsWithCommentsCount > Math.min(statistics.documentCount, total) ||
      documentsWithUnresolvedThreadsCount >
        Math.min(documentsWithCommentsCount, total - resolvedThreadCount)
    ) {
      throw new Error("Invalid statistics response.");
    }
    statistics.details = {
      documentsWithCommentsCount,
      documentsWithUnresolvedThreadsCount,
      resolvedThreadCount,
      replyCount: toCommentCount(details.replyCount),
      revisionCount: toSafeNumber(details.revisionCount),
    };
  }
  return statistics;
};
