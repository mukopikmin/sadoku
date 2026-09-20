import { useQuery } from "@tanstack/react-query";
import { loadDocuments, loadPreviewDocument } from "../api/document";
import { loadDirectoryStatus } from "../api/directoryStatus";
import {
  directoryStatusQueryKey,
  documentsQueryKey,
  previewDocumentQueryKey,
} from "./previewQueryKeys";

export const useDocumentsQuery = () =>
  useQuery({ queryFn: loadDocuments, queryKey: documentsQueryKey });

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
