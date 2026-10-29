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
import { HighlightOverlay } from "../../markdown/HighlightOverlay";
import { MarkdownThemeContext } from "../../markdown/MarkdownThemeContext";

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
    "revision-highlight": ({ children, "data-revision-changed": changed }: {
      children?: ReactNode;
      "data-revision-changed"?: string;
    }) => (
      <RevisionHighlight kind={changed === "true" ? highlightKind : undefined}>
        {children}
      </RevisionHighlight>
    ),
  }), [highlightKind, showHtmlComments]);

  return (
    <MarkdownThemeContext.Provider value={theme}>
      <Box className="markdown-preview" ref={root}>
        <HighlightOverlay layouts={highlightLayouts} />
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
                  data-revision-block=""
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
              showHtmlComments,
            }]]
            : sharedMarkdownRehypePlugins}
          remarkPlugins={sharedMarkdownRemarkPlugins}
        >
          {frontMatter?.bodyMarkdown ?? markdown}
        </ReactMarkdown>
      </Box>
    </MarkdownThemeContext.Provider>
  );
};
