import { useQuery } from "@tanstack/react-query";
import { loadSession } from "../api/session";
import { sessionQueryKey } from "./previewQueryKeys";

export const useSessionQuery = () =>
  useQuery({ queryFn: loadSession, queryKey: sessionQueryKey });
