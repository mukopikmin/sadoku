import { List } from "@chakra-ui/react";
import { useContext } from "react";
import { MarkdownListDepthContext, markdownListIndentEm } from "../listContext";
import type { MarkdownComponentProps } from "../rendererTypes";
import { mergeClassNames } from "../rendererUtils";

export const MarkdownUnorderedList = ({
  children,
  className,
  node: _node,
  ...props
}: MarkdownComponentProps<"ul">) => {
  const listDepth = useContext(MarkdownListDepthContext);
  return (
    <MarkdownListDepthContext.Provider value={listDepth + 1}>
      <List.Root
        as="ul"
        className={mergeClassNames("comment-markdown-list", className)}
        listStylePosition="outside"
        m="0"
        pt="0"
        ps={`${markdownListIndentEm}em`}
        {...props}
      >
        {children}
      </List.Root>
    </MarkdownListDepthContext.Provider>
  );
};
