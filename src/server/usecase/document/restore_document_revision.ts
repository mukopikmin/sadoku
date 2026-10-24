import { getDocumentRevision } from "./get_document_revision.ts";
import type { DocumentRevisionReader } from "./ports.ts";
import type { DirectoryDocument } from "./types.ts";
import type { CommentsStore } from "../comment/ports.ts";
import { readResolvedCommentsDocument } from "../comment/position.ts";

export type RestoreDocumentError = {
  type: "restore_conflict" | "restore_unsafe_path";
};

export type DocumentRestorer = {
  read: (filePath: string) => Promise<string | undefined>;
  replace: (
    filePath: string,
    markdown: string,
    expectedMarkdown: string | undefined,
  ) => Promise<void>;
};

export const restoreDocumentRevision = async (
  document: DirectoryDocument,
  revisionId: number,
  expectedMarkdown: string | undefined,
  deps: {
    revisions: Pick<DocumentRevisionReader, "findRevision">;
    recordRevision: (documentId: number, markdown: string) => Promise<void>;
    restorer: DocumentRestorer;
    commentsStore: Pick<CommentsStore, "read" | "write">;
  },
): Promise<void> => {
  const revision = await getDocumentRevision(
    document.id,
    revisionId,
    deps.revisions,
  );
  const current = await deps.restorer.read(document.filePath);
  if (current !== expectedMarkdown) {
    throw { type: "restore_conflict" } satisfies RestoreDocumentError;
  }
  // Preserve live edits even when they have never been saved as a revision.
  if (current !== undefined) await deps.recordRevision(document.id, current);
  await deps.restorer.replace(document.filePath, revision.markdown, current);
  document.deleted = false;
  // Snapshot pointers and comment positions must advance together. Persist even
  // an empty comment list so deleted-file previews use the restored contents.
  const comments = await readResolvedCommentsDocument(
    document.filePath,
    document.filePath,
    deps.commentsStore,
    () => Promise.resolve(revision.markdown),
  );
  if (comments.comments.length === 0) {
    await deps.commentsStore.write(document.filePath, comments);
  }
  await deps.recordRevision(document.id, revision.markdown);
};
