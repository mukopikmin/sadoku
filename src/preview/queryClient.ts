import { QueryClient } from "@tanstack/react-query";

export const createPreviewQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: Infinity,
      },
    },
  });
