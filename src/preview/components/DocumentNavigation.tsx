import { Flex } from "@chakra-ui/react";
import type { ComponentProps } from "react";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import { DocumentViewSwitch } from "./DocumentViewSwitch";

type Props = ComponentProps<typeof DocumentViewSwitch> & { markdown: string };

export const DocumentNavigation = ({ markdown, ...viewProps }: Props) => (
  <Flex align="center" gap="3" flexShrink="0" wrap="wrap">
    {viewProps.view === "preview" && <TableOfContents markdown={markdown} />}
    <DocumentViewSwitch {...viewProps} />
  </Flex>
);
