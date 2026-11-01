import {
  Button,
  Dialog,
  Field,
  Heading,
  Input,
  Portal,
  Text,
} from "@chakra-ui/react";
import { Pencil } from "lucide-react";
import { memo, useRef, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export const DocumentTitle = memo(function DocumentTitle({
  documentId,
  title,
}: {
  documentId: number;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useDocumentTitle(documentId);
  return (
    <>
      {title && (
        <Heading as="h1" size="3xl" gridColumn="1 / -1" overflowWrap="anywhere">
          {title}
        </Heading>
      )}
      <Button
        justifySelf="start"
        size="sm"
        variant="ghost"
        onClick={() => {
          setDraft(title ?? "");
          mutation.reset();
          setOpen(true);
        }}
      >
        {title && <Pencil aria-hidden="true" />}
        {title ? "Edit title" : "Set title"}
      </Button>
      <Dialog.Root
        open={open}
        onOpenChange={({ open }) => {
          if (!mutation.isPending) setOpen(open);
        }}
        initialFocusEl={() => inputRef.current}
        closeOnEscape={!mutation.isPending}
        closeOnInteractOutside={!mutation.isPending}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (mutation.isPending) return;
                  mutation.mutate(draft, { onSuccess: () => setOpen(false) });
                }}
              >
                <Dialog.Header>
                  <Dialog.Title>Document title</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <Field.Root>
                    <Field.Label>Title</Field.Label>
                    <Input
                      ref={inputRef}
                      value={draft}
                      disabled={mutation.isPending}
                      onChange={(event) => setDraft(event.currentTarget.value)}
                    />
                    <Field.HelperText>
                      Leave empty to remove the title. Markdown headings are
                      saved separately.
                    </Field.HelperText>
                  </Field.Root>
                  {mutation.error && (
                    <Text role="alert" color="fg.error">
                      {mutation.error.message}
                    </Text>
                  )}
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={mutation.isPending}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={mutation.isPending}
                    disabled={mutation.isPending}
                  >
                    Save
                  </Button>
                </Dialog.Footer>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
});
