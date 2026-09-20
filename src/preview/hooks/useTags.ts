import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  loadTags,
  replaceDocumentTags,
  type TagReference,
  updateTag,
} from "../api/tags";
import {
  documentsQueryKey,
  previewDocumentQueryKey,
  tagsQueryKey,
} from "./previewQueryKeys";

export const useTagsQuery = (enabled = true) =>
  useQuery({ enabled, queryFn: loadTags, queryKey: tagsQueryKey });

export const useUpdateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      { id, name, backgroundColor }: {
        id: number;
        name: string;
        backgroundColor: string;
      },
    ) => updateTag(id, name, backgroundColor),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tagsQueryKey }),
        queryClient.invalidateQueries({ queryKey: documentsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["preview-document"] }),
      ]);
    },
  });
};

export const useTagActions = (documentId: number) => {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tagsQueryKey }),
      queryClient.invalidateQueries({ queryKey: documentsQueryKey }),
      queryClient.invalidateQueries({
        queryKey: previewDocumentQueryKey(documentId),
      }),
    ]);
  };
  const replaceMutation = useMutation({
    mutationFn: (tags: TagReference[]) => replaceDocumentTags(documentId, tags),
    onSuccess: refresh,
  });
  return {
    pending: replaceMutation.isPending,
    replace: replaceMutation.mutateAsync,
  };
};
