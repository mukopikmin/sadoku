import { Box, Flex } from "@chakra-ui/react";
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
    <Box as="section" aria-label="Document header" ref={headerRef} mb="6">
      <Flex
        role="group"
        aria-label="Document title actions"
        wrap="wrap"
        justify="space-between"
        align="center"
        gap="3"
      >
        <DocumentTitle key={documentId} documentId={documentId} title={title} />
        {trailingAction}
      </Flex>
    </Box>
  );
};
