import type {
  InitializeDocumentSnapshot,
  ReadMarkdownDocument,
} from "./ports.ts";
import type { DirectoryDocument } from "./types.ts";
import { initializeDocumentSnapshot } from "./initialize_document_snapshot.ts";

export const loadLiveDocument = async (
  document: DirectoryDocument,
  readMarkdown: ReadMarkdownDocument,
  initializeSnapshot?: InitializeDocumentSnapshot,
): Promise<{ fileUrl?: string; markdown: string }> => {
  const content = await readMarkdown(document.filePath);
  await initializeDocumentSnapshot(
    initializeSnapshot,
    document.id,
    content.markdown,
  );
  return content;
};
