import { loadPreviewDocument } from "../api/document";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toaster } from "../components/ui/toaster";
import {
  isTableLayoutConflict,
  loadTableLayouts,
  saveTableLayout,
} from "../api/tableLayouts";
import {
  extractTablePositions,
  TableLayoutReloadRequiredError,
  type TableLayout,
} from "../models/tableLayout";
import { extractAgentFrontMatter } from "../pages/markdown/frontMatter";
import { tableLayoutsQueryKey } from "./previewQueryKeys";

type TableLayoutsState =
  | { status: "ready"; tables: TableLayout[] }
  | { status: "loading" | "error" };

export const useTableLayouts = (
  documentId: number | undefined,
  markdown: string,
  documentPath?: string,
) => {
  const positions = useMemo(
    () =>
      extractTablePositions(
        extractAgentFrontMatter(markdown, documentPath)?.bodyMarkdown ??
          markdown,
      ),
    [markdown, documentPath],
  );
  const queryClient = useQueryClient();
  const queryKey = tableLayoutsQueryKey(documentId, markdown, documentPath);
  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (documentId === undefined) throw new Error("No document selected.");
      return loadTableLayouts(documentId, markdown, positions);
    },
    enabled: documentId !== undefined && positions.length > 0,
    // A cached old revision must reconcile again after a restore or navigation.
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { error, errorUpdatedAt, refetch } = query;
  useEffect(() => {
    if (!error) return;
    toaster.create({
      type: "error",
      title: "Could not restore column widths",
      description: error.message,
      closable: true,
      action: isTableLayoutConflict(error)
        ? {
            label: "Reload preview",
            onClick: () => globalThis.location.reload(),
          }
        : {
            label: "Retry",
            onClick: () => {
              void refetch();
            },
          },
    });
  }, [error, errorUpdatedAt, refetch]);
  const mutation = useMutation({
    mutationFn: async ({ id, widths }: { id: string; widths: number[] }) => {
      if (documentId === undefined) throw new Error("No document selected.");
      try {
        return await saveTableLayout(documentId, markdown, id, widths);
      } catch (error) {
        if (!isTableLayoutConflict(error)) throw error;
      }
      // Reconcile once against fresh source; never guess a replacement table ID.
      const latest = await loadPreviewDocument(documentId);
      const latestPositions = extractTablePositions(
        extractAgentFrontMatter(latest.markdown, documentPath)?.bodyMarkdown ??
          latest.markdown,
      );
      const layouts = await loadTableLayouts(
        documentId,
        latest.markdown,
        latestPositions,
      );
      const matched = layouts.find((layout) => layout.id === id);
      if (!matched) throw new TableLayoutReloadRequiredError();
      return saveTableLayout(
        documentId,
        latest.markdown,
        id,
        widths.slice(0, matched.columnCount),
      );
    },
    scope: { id: `table-layouts-${documentId}` },
    onSuccess: (layout) => {
      queryClient.setQueryData<TableLayout[]>(queryKey, (current) =>
        current?.map((entry) =>
          entry.id === layout.id
            ? { ...entry, columnWidths: layout.columnWidths }
            : entry,
        ),
      );
    },
  });
  const getState = (): TableLayoutsState => {
    if (positions.length === 0) return { status: "ready", tables: [] };
    if (query.isFetching) return { status: "loading" };
    if (query.error) return { status: "error" };
    if (query.data === undefined) return { status: "loading" };
    return { status: "ready", tables: query.data };
  };

  return {
    state: getState(),
    save: (id: string, widths: number[]) =>
      mutation.mutateAsync({ id, widths }),
  };
};
