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
import { memo, useRef } from "react";
import { useDocumentTitleEditor } from "../hooks/useDocumentTitleEditor";

export const DocumentTitle = memo(function DocumentTitle({
  documentId,
  title,
}: {
  documentId: number;
  title?: string;
}) {
  const editor = useDocumentTitleEditor(documentId, title);
  const { state } = editor;
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = state.status === "saving";
  return (
    <>
      {title && (
        <Heading
          as="h1"
          size="3xl"
          flexBasis="full"
          minW="0"
          overflowWrap="anywhere"
        >
          {title}
        </Heading>
      )}
      <Button
        flexShrink="0"
        size="sm"
        variant="ghost"
        onClick={() => editor.open()}
      >
        {title && <Pencil aria-hidden="true" />}
        {title ? "Edit title" : "Set title"}
      </Button>
      <Dialog.Root
        open={state.status !== "closed"}
        onOpenChange={({ open }) => {
          if (!open) editor.close();
        }}
        initialFocusEl={() => inputRef.current}
        closeOnEscape={!pending}
        closeOnInteractOutside={!pending}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void editor.save();
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
                      value={state.status === "closed" ? "" : state.draft}
                      disabled={pending}
                      onChange={(event) =>
                        editor.change(event.currentTarget.value)
                      }
                    />
                    <Field.HelperText>
                      Leave empty to remove the title. Markdown headings are
                      saved separately.
                    </Field.HelperText>
                  </Field.Root>
                  {state.status === "error" && (
                    <Text role="alert" color="fg.error">
                      {state.message}
                    </Text>
                  )}
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={editor.close}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={pending} disabled={pending}>
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
