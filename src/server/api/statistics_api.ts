import { noStoreJson } from "../responses.ts";
import {
  getStatistics,
  type StatisticsReader,
} from "../usecase/statistics/get_statistics.ts";

export const getDatabaseStatistics = async (
  reader: StatisticsReader,
): Promise<Response> => noStoreJson(await getStatistics(reader));
