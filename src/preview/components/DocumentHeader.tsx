import { Grid } from "@chakra-ui/react";
import { type ReactNode, type RefObject } from "react";
import { DocumentTitle } from "./DocumentTitle";

export const DocumentHeader = ({
  documentId,
  headerRef,
  trailingAction,
  title,
}: {
  documentId: number;
  headerRef?: RefObject<HTMLDivElement | null>;
  trailingAction?: ReactNode;
  title?: string;
}) => {
  return (
    <Grid
      as="section"
      aria-label="Document header"
      ref={headerRef}
      mb="6"
      gap="3"
    >
      <Grid
        role="group"
        aria-label="Document title actions"
        templateColumns="minmax(0, 1fr) auto"
        alignItems="center"
        gap="3"
      >
        <DocumentTitle key={documentId} documentId={documentId} title={title} />
        {trailingAction}
      </Grid>
    </Grid>
  );
};
