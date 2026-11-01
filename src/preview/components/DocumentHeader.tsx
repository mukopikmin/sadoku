import { Box, Flex } from "@chakra-ui/react";
import { memo, type RefObject } from "react";
import { DocumentTitle } from "./DocumentTitle";
import { TableOfContents } from "../pages/markdown/TableOfContents";

export const DocumentHeader = memo(function DocumentHeader({
  documentId,
  headerRef,
  markdown,
  title,
}: {
  documentId: number;
  headerRef?: RefObject<HTMLDivElement | null>;
  markdown: string;
  title?: string;
}) {
  return (
    <Flex
      as="section"
      aria-label="Document header"
      ref={headerRef}
      align="start"
      gap="3"
    >
      <Box flex="1" minW="0">
        <DocumentTitle
          key={documentId}
          documentId={documentId}
          title={title}
          trailingAction={<TableOfContents markdown={markdown} />}
        />
      </Box>
    </Flex>
  );
});
