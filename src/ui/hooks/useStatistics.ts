import { useQuery } from "@connectrpc/connect-query";
import { PreviewService } from "../gen/sadoku/preview/v1/preview_pb";
import { toDatabaseStatistics } from "../api/statistics";

export const useStatisticsQuery = (enabled: boolean) =>
  useQuery(
    PreviewService.method.getStatistics,
    { includeDetails: true },
    { enabled, select: toDatabaseStatistics, staleTime: 0 },
  );
