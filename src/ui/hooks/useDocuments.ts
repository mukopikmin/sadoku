import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  loadDocuments,
  loadPreviewDocument,
  reloadDocuments,
} from "../api/document";
import { loadDirectoryStatus } from "../api/directoryStatus";
import { toaster } from "../components/ui/toaster";
import {
  allCommentsQueryKey,
  directoryStatusQueryKey,
  documentsQueryKey,
  previewDocumentQueryKey,
  previewDocumentsQueryKey,
} from "./previewQueryKeys";

export const useDocumentsQuery = () =>
  useQuery({ queryFn: loadDocuments, queryKey: documentsQueryKey });

export const useReloadDocuments = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: reloadDocuments,
    onSuccess: async () => {
      await Promise.all(
        [
          documentsQueryKey,
          directoryStatusQueryKey,
          previewDocumentsQueryKey,
          allCommentsQueryKey,
        ].map((queryKey) =>
          client.invalidateQueries({ queryKey }, { throwOnError: true }),
        ),
      );
    },
    onError: (error) => {
      toaster.create({
        type: "error",
        title: "Could not reload documents",
        description: error.message,
        closable: true,
      });
    },
  });
};

export const useDirectoryStatusQuery = () =>
  useQuery({
    queryFn: loadDirectoryStatus,
    queryKey: directoryStatusQueryKey,
    refetchInterval: (query) =>
      query.state.data?.state === "loading" ? 250 : false,
  });

export const usePreviewDocumentQuery = (documentId?: number, enabled = true) =>
  useQuery({
    enabled,
    queryFn: () => loadPreviewDocument(documentId!),
    queryKey: previewDocumentQueryKey(documentId),
  });
