import { useMemo, type ReactNode } from "react";
import { DocumentDiffBlock } from "../DocumentDiffBlock";
import { remarkDocumentDiff } from "../remarkDocumentDiff";
import { ReadOnlyMarkdownPreview } from "../../pages/markdown/ReadOnlyMarkdownPreview";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import {
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../markdownRenderers";
import { createCommentableMarkdownComponents } from "./commentableMarkdownComponents";

type CommentableMarkdownProps = {
  children: string;
  showHtmlComments: boolean;
  previousMarkdown?: string;
  documentPath?: string;
  theme: "dark" | "default";
};

export const CommentableMarkdown = ({
  children,
  showHtmlComments,
  previousMarkdown,
  documentPath,
  theme,
}: CommentableMarkdownProps) => {
  const components = useMemo<Components>(() => {
    const markdownComponents = createCommentableMarkdownComponents();
    if (!showHtmlComments) {
      markdownComponents["html-comment"] = () => null;
    }
    return {
      ...markdownComponents,
      "revision-addition": ({ children }: { children?: ReactNode }) => (
        <DocumentDiffBlock kind="addition">{children}</DocumentDiffBlock>
      ),
      "revision-deletion": ({ markdown }: { markdown?: string }) => (
        <DocumentDiffBlock kind="deletion">
          <ReadOnlyMarkdownPreview
            markdown={markdown ?? ""}
            documentPath={documentPath}
            showHtmlComments={showHtmlComments}
            theme={theme}
          />
        </DocumentDiffBlock>
      ),
    };
  }, [documentPath, showHtmlComments, theme]);

  return (
    <ReactMarkdown
      components={components}
      rehypePlugins={[
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "wrap",
            properties: { className: "heading-anchor" },
            test: (heading) =>
              !heading.children.some(
                (child) => child.type === "element" && child.tagName === "a",
              ),
          },
        ],
        ...sharedMarkdownRehypePlugins,
      ]}
      remarkPlugins={
        previousMarkdown === undefined
          ? sharedMarkdownRemarkPlugins
          : [
              ...sharedMarkdownRemarkPlugins,
              [
                remarkDocumentDiff,
                {
                  previous: previousMarkdown,
                  current: children,
                },
              ],
            ]
      }
    >
      {children}
    </ReactMarkdown>
  );
};
