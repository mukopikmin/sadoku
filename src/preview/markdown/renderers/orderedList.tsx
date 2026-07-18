import { List } from "@chakra-ui/react";
import { useContext } from "react";
import { MarkdownListDepthContext, markdownListIndentEm } from "../listContext";
import type { MarkdownComponentProps } from "../rendererTypes";
import { mergeClassNames } from "../rendererUtils";

export const MarkdownOrderedList = ({
  children,
  className,
  node: _node,
  ...props
}: MarkdownComponentProps<"ol">) => {
  const listDepth = useContext(MarkdownListDepthContext);
  const isNested = listDepth > 0;
  return (
    <MarkdownListDepthContext.Provider value={listDepth + 1}>
      <List.Root
        as="ol"
        className={mergeClassNames("comment-markdown-list", className)}
        listStylePosition="outside"
        mt={isNested ? "0.25em" : "2"}
        mb={isNested ? "0" : "4"}
        ps={`${markdownListIndentEm}em`}
        {...props}
      >
        {children}
      </List.Root>
    </MarkdownListDepthContext.Provider>
  );
};
