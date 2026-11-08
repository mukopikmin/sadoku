import {
  Badge,
  Breadcrumb,
  Button,
  CloseButton,
  Dialog,
  Flex,
  IconButton,
  Link,
  Portal,
  Text,
} from "@chakra-ui/react";
import { Copy } from "lucide-react";
import { Fragment } from "react";
import type { DocumentSummary } from "../models/document";
import { useDocumentBreadcrumb } from "../hooks/useDocumentBreadcrumb";
import { Tooltip } from "./ui/tooltip";

type DocumentBreadcrumbProps = {
  document: DocumentSummary;
  documents: DocumentSummary[];
  onSelectDocument: (id: number) => void;
  onSelectDocuments: () => void;
};

const fileName = (path: string) => path.split("/").at(-1) ?? path;

export const DocumentBreadcrumb = ({
  document,
  documents,
  onSelectDocument,
  onSelectDocuments,
}: DocumentBreadcrumbProps) => {
  const breadcrumb = useDocumentBreadcrumb(
    document,
    documents,
    onSelectDocument,
  );
  const { parts, directories, directoryDocuments, state } = breadcrumb;

  return (
    <>
      <Breadcrumb.Root aria-label="Document path" mb="6">
        <Breadcrumb.List flexWrap="wrap">
          <Breadcrumb.Item>
            <Breadcrumb.Link
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onSelectDocuments();
              }}
            >
              Documents
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          {directories.map((directory, index) => {
            const path = directories.slice(0, index + 1).join("/");
            return (
              <Fragment key={path}>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Link
                    as="button"
                    color="fg.muted"
                    cursor="pointer"
                    onClick={() => breadcrumb.openDirectory(path)}
                    type="button"
                  >
                    {directory}
                  </Link>
                </Breadcrumb.Item>
              </Fragment>
            );
          })}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.CurrentLink>{parts.at(-1)}</Breadcrumb.CurrentLink>
            <Tooltip content="Copy path">
              <IconButton
                aria-label="Copy path"
                onClick={() => void breadcrumb.copy()}
                size="xs"
                variant="ghost"
              >
                <Copy aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>

      <Dialog.Root
        onOpenChange={({ open }) => {
          if (!open) breadcrumb.close();
        }}
        open={state.status === "directory"}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {state.status === "directory" ? state.path : ""}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {directoryDocuments.length === 0 ? (
                  <Text color="fg.muted">
                    No Markdown documents in this directory.
                  </Text>
                ) : (
                  <Flex direction="column" gap="2">
                    {directoryDocuments.map((item) => (
                      <Button
                        aria-current={
                          item.id === document.id ? "page" : undefined
                        }
                        colorPalette={
                          item.id === document.id ? "blue" : undefined
                        }
                        justifyContent="flex-start"
                        key={item.id}
                        onClick={() => {
                          breadcrumb.select(item.id);
                        }}
                        variant={item.id === document.id ? "subtle" : "ghost"}
                      >
                        <Text flex="1" textAlign="start">
                          {fileName(item.relativePath)}
                        </Text>
                        {item.id === document.id && (
                          <Badge colorPalette="blue" variant="solid">
                            Current
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </Flex>
                )}
              </Dialog.Body>
              <Dialog.CloseTrigger asChild>
                <CloseButton aria-label="Close directory" size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
};
