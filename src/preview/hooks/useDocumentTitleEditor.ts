import { useDocumentTitle } from "./useDocumentTitle";
import { useTextEditor } from "./useTextEditor";

export const useDocumentTitleEditor = (documentId: number, title?: string) => {
  const mutation = useDocumentTitle(documentId);
  return useTextEditor({
    scope: documentId,
    initiallyOpen: false,
    initialValue: title ?? "",
    allowEmpty: true,
    onSave: async (draft) => {
      await mutation.mutateAsync(draft);
    },
  });
};
