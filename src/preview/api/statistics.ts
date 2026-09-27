import type { GetStatisticsResponse } from "../../../gen/ts/sadoku/preview/v1/preview_pb";

export type DatabaseStatistics = {
  commentCount: { bot: number; human: number };
  databaseSize: number;
  documentCount: number;
};

const toSafeNumber = (value: bigint): number => {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Invalid statistics response.");
  }
  return Number(value);
};

export const toDatabaseStatistics = (
  response: GetStatisticsResponse,
): DatabaseStatistics => {
  if (!response.commentCount) {
    throw new Error("Invalid statistics response.");
  }
  return {
    commentCount: {
      bot: toSafeNumber(response.commentCount.bot),
      human: toSafeNumber(response.commentCount.human),
    },
    databaseSize: toSafeNumber(response.databaseSize),
    documentCount: toSafeNumber(response.documentCount),
  };
};
