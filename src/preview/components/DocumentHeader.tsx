import { Box, Flex } from "@chakra-ui/react";
import { memo, type ReactNode, type RefObject } from "react";
import { DocumentTitle } from "./DocumentTitle";

export const DocumentHeader = memo(function DocumentHeader({
  documentId,
  headerRef,
  trailingAction,
  title,
}: {
  documentId: number;
  headerRef?: RefObject<HTMLDivElement | null>;
  trailingAction?: ReactNode;
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
          trailingAction={trailingAction}
        />
      </Box>
    </Flex>
  );
});
