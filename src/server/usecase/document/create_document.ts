import type { DocumentStore } from "./ports.ts";
import type { DirectoryDocument, DirectorySession, Document } from "./types.ts";

export type CreateDocumentError = {
  type:
    | "invalid_document_input"
    | "document_exists"
    | "creation_unavailable"
    | "document_registration_failed";
  message: string;
};

export type CreateDocumentInput = {
  directory: string;
  filename: string;
  title: string;
};

export type DocumentCreator = {
  create: (
    directory: string,
    filename: string,
    markdown: string,
  ) => Promise<string>;
};

export const createDocument = async (
  session: DirectorySession,
  input: CreateDocumentInput,
  deps: {
    documentStore: DocumentStore;
    creator: DocumentCreator;
    markdownExtensions: readonly string[];
  },
): Promise<DirectoryDocument> => {
  if (!session.canCreateDocuments) {
    throw {
      type: "creation_unavailable",
      message: "File creation is available for local directory previews only.",
    } satisfies CreateDocumentError;
  }
  const filename = input.filename.trim();
  const title = input.title.trim();
  const directory = input.directory;
  if (
    !filename || /[\\/\u0000-\u001f<>:"|?*]/.test(filename) ||
    filename === "." || filename === ".." || /[. ]$/.test(filename) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(filename) ||
    /[\r\n\u0000]/.test(title) ||
    (directory !== "" &&
      directory.split("/").some((part) =>
        !part || part === "." || part === ".." ||
        /[\\\u0000-\u001f:]/.test(part)
      ))
  ) {
    throw {
      type: "invalid_document_input",
      message: "Enter a valid filename, directory, and single-line title.",
    } satisfies CreateDocumentError;
  }
  const resolvedFilename = filename.includes(".") ? filename : `${filename}.md`;
  if (
    !deps.markdownExtensions.some((extension) =>
      resolvedFilename.toLowerCase().endsWith(extension.toLowerCase())
    )
  ) {
    throw {
      type: "invalid_document_input",
      message: "Use a configured Markdown file extension.",
    } satisfies CreateDocumentError;
  }
  const markdown = "";
  const filePath = await deps.creator.create(
    directory,
    resolvedFilename,
    markdown,
  );
  let stored: Document;
  try {
    stored = await deps.documentStore.ensure(filePath);
    if (deps.documentStore.setTitle) {
      await deps.documentStore.setTitle(stored.id, title || undefined);
    } else if (title) {
      throw new Error("Title storage unavailable.");
    }
    await deps.documentStore.initializeSnapshot?.(stored.id, markdown);
  } catch {
    throw {
      type: "document_registration_failed",
      message:
        "The file was created, but could not be added to the preview. Reopen this directory to load it.",
    } satisfies CreateDocumentError;
  }
  const document = {
    ...stored,
    displayTitle: title || undefined,
    deleted: false,
    relativePath: directory
      ? `${directory}/${resolvedFilename}`
      : resolvedFilename,
    title: resolvedFilename,
  };
  const previousIndex = session.documents.findIndex(({ id }) =>
    id === document.id
  );
  if (previousIndex !== -1) session.documents.splice(previousIndex, 1);
  session.documents.push(document);
  session.documents.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
  session.documentsById.set(document.id, document);
  return document;
};
