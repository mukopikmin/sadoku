import { useEffect, useState } from "react";
import { connectHotReload } from "../api/hotReload";
import { useQueryClient } from "@tanstack/react-query";
import { commentsQueryKey } from "./usePreviewData";

export const useHotReload = (documentId?: number) => {
  const [reloadAvailable, setReloadAvailable] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setReloadAvailable(false);
    return connectHotReload({
      documentId,
      onReloadAvailable: () => setReloadAvailable(true),
      onCommentsChanged: () => {
        void queryClient.invalidateQueries({
          queryKey: commentsQueryKey(documentId),
        });
      },
    });
  }, [documentId, queryClient]);

  return {
    clearReloadAvailable: () => setReloadAvailable(false),
    reloadAvailable,
  };
};
