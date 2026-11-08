import { useState } from "react";
import type { DocumentSummary } from "../models/document";
import { useClipboard } from "./useClipboard";
import { toaster } from "../components/ui/toaster";
const parentDirectory = (path: string) => {
  const separator = path.lastIndexOf("/");
  return separator === -1 ? "" : path.slice(0, separator);
};

export const useDocumentBreadcrumb = (
  document: DocumentSummary,
  documents: DocumentSummary[],
  onSelectDocument: (id: number) => void,
) => {
  const [state, setState] = useState<
    { status: "closed" } | { status: "directory"; path: string }
  >({ status: "closed" });
  const parts = document.relativePath.split("/").filter(Boolean);
  const clipboard = useClipboard(document.relativePath, {
    title: "Path copied",
    description: "The document path was copied to the clipboard.",
    onError: () =>
      toaster.create({
        closable: true,
        description:
          "Check your browser's clipboard permissions and try again.",
        title: "Could not copy path",
        type: "error",
      }),
  });
  return {
    state,
    parts,
    directories: parts.slice(0, -1),
    directoryDocuments:
      state.status === "closed"
        ? []
        : documents.filter(
            (item) => parentDirectory(item.relativePath) === state.path,
          ),
    copy: clipboard.copy,
    openDirectory: (path: string) => setState({ status: "directory", path }),
    close: () => setState({ status: "closed" }),
    select: (id: number) => {
      setState({ status: "closed" });
      onSelectDocument(id);
    },
  };
};
