import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateDocumentTitle } from "../api/document";
import { documentsQueryKey, previewDocumentQueryKey } from "./previewQueryKeys";

export const useDocumentTitle = (documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => updateDocumentTitle(documentId, title),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: previewDocumentQueryKey(documentId),
        }),
        queryClient.invalidateQueries({ queryKey: documentsQueryKey }),
      ]);
    },
  });
};
