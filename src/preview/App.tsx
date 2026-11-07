import { Button, Container, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "@tanstack/react-router";
import { PreviewShell } from "./components/layout/PreviewHeader";
import { PreviewLayout } from "./components/layout/PreviewLayout";
import { CreateDocumentDialog } from "./components/CreateDocumentDialog";
import { DocumentListPage } from "./pages/DocumentListPage";
import { DocumentLoadingPage } from "./pages/DocumentLoadingPage";
import { DocumentPreviewPage } from "./pages/DocumentPreviewPage";
import { markdownStyles } from "./markdown/markdownStyles";
import { usePreviewApp } from "./hooks/usePreviewApp";

export const App = () => {
  const state = usePreviewApp();
  if (state.status === "loading" || state.status === "error")
    return (
      <>
        <style>{markdownStyles}</style>
        <PreviewShell>
          {state.status === "loading" ? "Loading preview..." : state.message}
        </PreviewShell>
      </>
    );
  if (state.status === "not-found")
    return (
      <>
        <style>{markdownStyles}</style>
        <PreviewShell>
          <Text fontWeight="semibold">Document not found.</Text>
        </PreviewShell>
        <Container as="main" maxW="980px" px="8" pb="16">
          <Button asChild variant="outline">
            <RouterLink to="/">Back to documents</RouterLink>
          </Button>
        </Container>
      </>
    );
  return (
    <PreviewLayout dialogs={state.dialogs} header={state.header}>
      {state.status === "list" ? (
        <>
          <DocumentListPage {...state.page} />
          <CreateDocumentDialog creator={state.creator} />
        </>
      ) : state.status === "document-loading" ||
        state.status === "document-error" ? (
        <DocumentLoadingPage {...state.page} />
      ) : (
        <DocumentPreviewPage {...state.page} />
      )}
    </PreviewLayout>
  );
};
