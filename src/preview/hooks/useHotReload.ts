import { useEffect, useState } from "react";
import { connectHotReload } from "../api/hotReload";
import { useQueryClient } from "@tanstack/react-query";
import { commentsQueryKey } from "./usePreviewData";

export const useHotReload = () => {
  const [reloadAvailable, setReloadAvailable] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    return connectHotReload({
      onReloadAvailable: () => setReloadAvailable(true),
      onCommentsChanged: () => {
        void queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      },
    });
  }, [queryClient]);

  return {
    clearReloadAvailable: () => setReloadAvailable(false),
    reloadAvailable,
  };
};
