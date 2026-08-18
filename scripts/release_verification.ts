export type PreviewDocument = {
  markdown?: string;
};

type PreviewDocumentSummary = {
  id: number;
};

const requireOk = (response: Response, description: string): Response => {
  if (!response.ok) {
    throw new Error(`${description} failed with ${response.status}.`);
  }
  return response;
};

export const fetchPreviewDocument = async (
  previewUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PreviewDocument> => {
  const documentsResponse = requireOk(
    await fetcher(new URL("/__sadoku/documents", previewUrl)),
    "Preview document list request",
  );
  const documents = await documentsResponse.json() as PreviewDocumentSummary[];
  const documentId = documents[0]?.id;
  if (documentId === undefined) {
    throw new Error("Preview document list was empty.");
  }

  const documentResponse = requireOk(
    await fetcher(
      new URL(
        `/__sadoku/documents/${encodeURIComponent(documentId)}`,
        previewUrl,
      ),
    ),
    "Preview document request",
  );
  return await documentResponse.json() as PreviewDocument;
};
