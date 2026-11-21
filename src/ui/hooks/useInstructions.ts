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
  scope?: InstructionScope,
  enabled = true,
) =>
  useQuery({
    enabled: enabled && scope !== undefined,
    queryFn: () => loadInstructions(scope!),
    queryKey: instructionsQueryKey(scope),
  });

export const useInstructionActions = (scope: InstructionScope) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: instructionsQueryKey(scope),
    });
  const createMutation = useMutation({
    mutationFn: (content: string) => createInstruction(scope, content),
    onSuccess: refresh,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      updateInstruction(scope, id, content),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInstruction(scope, id),
    onSuccess: refresh,
  });
  return {
    create: createMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    pending:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
    update: updateMutation.mutateAsync,
  };
};
