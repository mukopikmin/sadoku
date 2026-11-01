import { Flex } from "@chakra-ui/react";
import type { ComponentProps } from "react";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import { DocumentViewSwitch } from "./DocumentViewSwitch";

type Props = ComponentProps<typeof DocumentViewSwitch> & { markdown: string };

export const DocumentNavigation = ({ markdown, ...viewProps }: Props) => (
  <Flex align="center" gap="3" minW="0" maxW="full" wrap="wrap">
    <TableOfContents markdown={markdown} />
    <DocumentViewSwitch {...viewProps} />
  </Flex>
);
