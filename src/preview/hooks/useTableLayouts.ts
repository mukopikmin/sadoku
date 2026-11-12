import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toaster } from "../components/ui/toaster";
import { loadTableLayouts, saveTableLayout } from "../api/tableLayouts";
import { extractTablePositions, type TableLayout } from "../models/tableLayout";
import { extractAgentFrontMatter } from "../pages/markdown/frontMatter";
import { tableLayoutsQueryKey } from "./previewQueryKeys";

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
    queryFn: () => loadTableLayouts(documentId!, markdown, positions),
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
      action: {
        label: "Retry",
        onClick: () => {
          void refetch();
        },
      },
    });
  }, [error, errorUpdatedAt, refetch]);
  const mutation = useMutation({
    mutationFn: ({ id, widths }: { id: string; widths: number[] }) =>
      saveTableLayout(documentId!, markdown, id, widths),
    scope: { id: `table-layouts-${documentId}` },
    onSuccess: (layout) => {
      queryClient.setQueryData<TableLayout[]>(queryKey, (current) =>
        current?.map((entry) => (entry.id === layout.id ? layout : entry)),
      );
    },
  });
  const state =
    positions.length === 0
      ? ({ status: "ready", tables: [] } as const)
      : query.isFetching
        ? ({ status: "loading" } as const)
        : query.error
          ? ({ status: "error", message: query.error.message } as const)
          : query.data !== undefined
            ? ({ status: "ready", tables: query.data } as const)
            : ({ status: "loading" } as const);

  return {
    state,
    retry: () => void query.refetch(),
    save: (id: string, widths: number[]) =>
      mutation.mutateAsync({ id, widths }),
  };
};
