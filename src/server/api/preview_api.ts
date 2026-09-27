import type { MessageInitShape } from "@bufbuild/protobuf";
import {
  GetSessionResponseSchema,
  GetStatisticsResponseSchema,
} from "../../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import { connectFailure } from "../connect/unary.ts";
import type { DirectorySession } from "../usecase/document/mod.ts";
import {
  getStatistics,
  type StatisticsReader,
} from "../usecase/statistics/get_statistics.ts";

const toUint64 = (value: number): bigint => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw connectFailure("internal", "Invalid statistics value.", 500);
  }
  return BigInt(value);
};

export const getSessionResponse = (
  session: DirectorySession,
): MessageInitShape<typeof GetSessionResponseSchema> => ({
  ...(session.pullRequest && { pullRequest: session.pullRequest }),
});

export const getStatisticsResponse = async (
  reader?: StatisticsReader,
): Promise<MessageInitShape<typeof GetStatisticsResponseSchema>> => {
  if (!reader) {
    throw connectFailure(
      "unimplemented",
      "Database statistics are not available.",
      501,
    );
  }
  const statistics = await getStatistics(reader);
  return {
    commentCount: {
      bot: toUint64(statistics.commentCount.bot),
      human: toUint64(statistics.commentCount.human),
    },
    databaseSize: toUint64(statistics.databaseSize),
    documentCount: toUint64(statistics.documentCount),
  };
};
