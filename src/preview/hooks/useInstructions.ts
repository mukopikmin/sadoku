import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInstruction,
  deleteInstruction,
  loadInstructions,
  updateInstruction,
} from "../api/instructions";
import type { InstructionScope } from "../models/instruction";
import { instructionsQueryKey } from "./previewQueryKeys";

export const useInstructionsQuery = (
  documentId?: InstructionScope,
  enabled = true,
) =>
  useQuery({
    enabled: enabled && documentId !== undefined,
    queryFn: () => loadInstructions(documentId!),
    queryKey: instructionsQueryKey(documentId),
  });

export const useInstructionActions = (documentId: InstructionScope) => {
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
