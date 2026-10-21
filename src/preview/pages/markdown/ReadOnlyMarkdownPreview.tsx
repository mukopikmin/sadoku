import { Box, DataList } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";
import { initializeMermaid } from "../../markdown/mermaid";
import { extractAgentFrontMatter } from "./frontMatter";

export const ReadOnlyMarkdownPreview = ({
  documentPath,
  markdown,
  showHtmlComments,
  theme,
}: {
  documentPath?: string;
  markdown: string;
  showHtmlComments: boolean;
  theme: "dark" | "default";
}) => {
  const root = useRef<HTMLDivElement>(null);
  const frontMatter = extractAgentFrontMatter(markdown, documentPath);
  useEffect(() => {
    if (root.current) {
      void initializeMermaid({ root: root.current, theme });
    }
  }, [markdown, showHtmlComments, theme]);

  return (
    <Box className="markdown-preview" ref={root}>
      {frontMatter && (
        <DataList.Root orientation={{ base: "vertical", md: "horizontal" }}>
          {frontMatter.items.map((item) => (
            <DataList.Item key={`${item.key}-${item.startLine}`}>
              <DataList.ItemLabel>{item.key}</DataList.ItemLabel>
              <DataList.ItemValue whiteSpace="pre-wrap" overflowWrap="anywhere">
                {item.value}
              </DataList.ItemValue>
            </DataList.Item>
          ))}
        </DataList.Root>
      )}
      <ReactMarkdown
        components={showHtmlComments
          ? sharedMarkdownComponents
          : { ...sharedMarkdownComponents, "html-comment": () => null }}
        rehypePlugins={sharedMarkdownRehypePlugins}
        remarkPlugins={sharedMarkdownRemarkPlugins}
      >
        {frontMatter?.bodyMarkdown ?? markdown}
      </ReactMarkdown>
    </Box>
  );
};
