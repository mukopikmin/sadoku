import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInstruction,
  deleteInstruction,
  loadInstructions,
  updateInstruction,
} from "../api/instructions";
import { instructionsQueryKey } from "./previewQueryKeys";

export const useInstructionsQuery = (documentId?: number, enabled = true) =>
  useQuery({
    enabled,
    queryFn: () => loadInstructions(documentId!),
    queryKey: instructionsQueryKey(documentId),
  });

export const useInstructionActions = (documentId: number) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: instructionsQueryKey(documentId),
    });
  const createMutation = useMutation({
    mutationFn: (content: string) => createInstruction(documentId, content),
    onSuccess: refresh,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      updateInstruction(documentId, id, content),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInstruction(documentId, id),
    onSuccess: refresh,
  });
  return {
    create: createMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    pending: createMutation.isPending || updateMutation.isPending ||
      deleteMutation.isPending,
    update: updateMutation.mutateAsync,
  };
};
