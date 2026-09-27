import { useQuery } from "@connectrpc/connect-query";
import { PreviewService } from "../../../gen/ts/sadoku/preview/v1/preview_pb";
import { toPreviewSession } from "../api/session";

export const useSessionQuery = () =>
  useQuery(PreviewService.method.getSession, {}, { select: toPreviewSession });
