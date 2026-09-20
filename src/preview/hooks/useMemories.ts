import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMemory, loadMemories } from "../api/memories";
import { memoriesQueryKey } from "./previewQueryKeys";

export const useMemoriesQuery = (documentId?: number, enabled = true) =>
  useQuery({
    enabled,
    queryFn: () => loadMemories(documentId!),
    queryKey: memoriesQueryKey(documentId),
  });

export const useDeleteMemory = (documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: number) => deleteMemory(documentId, memoryId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: memoriesQueryKey(documentId),
      }),
  });
};
