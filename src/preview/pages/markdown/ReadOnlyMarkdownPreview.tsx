import { Box, DataList } from "@chakra-ui/react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";
import { initializeMermaid } from "../../markdown/mermaid";
import { extractAgentFrontMatter } from "./frontMatter";
import { rehypeRevisionHighlights } from "../../markdown/rehypeRevisionHighlights";
import { RevisionHighlight } from "../../markdown/RevisionHighlight";
import { containsChangedLine } from "../../markdown/revisionDiff";
import { useRevisionHighlightLayout } from "../../markdown/useRevisionHighlightLayout";

export const ReadOnlyMarkdownPreview = ({
  documentPath,
  markdown,
  showHtmlComments,
  theme,
  revisionHighlight,
}: {
  documentPath?: string;
  markdown: string;
  showHtmlComments: boolean;
  theme: "dark" | "default";
  revisionHighlight?: {
    lines: ReadonlySet<number>;
    kind: "addition" | "deletion";
  };
}) => {
  const root = useRef<HTMLDivElement>(null);
  const highlightLayouts = useRevisionHighlightLayout(root);
  const frontMatter = extractAgentFrontMatter(markdown, documentPath);
  useEffect(() => {
    if (root.current) {
      void initializeMermaid({ root: root.current, theme });
    }
  }, [
    markdown,
    showHtmlComments,
    theme,
    revisionHighlight?.kind,
    revisionHighlight?.lines,
  ]);

  const highlightKind = revisionHighlight?.kind;
  const components = useMemo(() => ({
    ...sharedMarkdownComponents,
    ...(!showHtmlComments ? { "html-comment": () => null } : {}),
    "revision-highlight": ({ children }: { children?: ReactNode }) => (
      <RevisionHighlight kind={highlightKind ?? "addition"}>
        {children}
      </RevisionHighlight>
    ),
  }), [highlightKind, showHtmlComments]);

  return (
    <Box className="markdown-preview" ref={root}>
      <Box aria-hidden="true" className="markdown-range-highlights">
        {highlightLayouts.map((layout, index) => (
          <Box
            className="markdown-range-highlight"
            bg={`syntax.${layout.kind}.bg`}
            height={`${Math.max(0, layout.bottom - layout.top)}px`}
            key={index}
            top={`${layout.top}px`}
          />
        ))}
      </Box>
      {frontMatter && (
        <DataList.Root orientation={{ base: "vertical", md: "horizontal" }}>
          {frontMatter.items.map((item) => {
            const changed = revisionHighlight && containsChangedLine(
              revisionHighlight.lines,
              item.startLine,
              item.endLine,
            );
            return (
              <DataList.Item
                key={`${item.key}-${item.startLine}`}
                data-revision-kind={changed
                  ? revisionHighlight.kind
                  : undefined}
                title={changed ? "Changed revision metadata" : undefined}
              >
                <DataList.ItemLabel>{item.key}</DataList.ItemLabel>
                <DataList.ItemValue
                  whiteSpace="pre-wrap"
                  overflowWrap="anywhere"
                >
                  {item.value}
                </DataList.ItemValue>
              </DataList.Item>
            );
          })}
        </DataList.Root>
      )}
      <ReactMarkdown
        components={components}
        rehypePlugins={revisionHighlight
          ? [...sharedMarkdownRehypePlugins, [rehypeRevisionHighlights, {
            changedLines: revisionHighlight.lines,
          }]]
          : sharedMarkdownRehypePlugins}
        remarkPlugins={sharedMarkdownRemarkPlugins}
      >
        {frontMatter?.bodyMarkdown ?? markdown}
      </ReactMarkdown>
    </Box>
  );
};
