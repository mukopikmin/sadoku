import { useMemo, type ReactNode } from "react";
import { DocumentDiffBlock } from "../DocumentDiffBlock";
import { remarkDocumentDiff } from "../remarkDocumentDiff";
import { Box, Stack } from "@chakra-ui/react";
import {
  DeletedCommentThreads,
  DeletedMarkdownBlock,
} from "./DeletedMarkdownBlock";
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
      "revision-inline-deletion": ({ children }: { children?: ReactNode }) => (
        <Box
          as="del"
          bg="highlight.deletion.bg"
          textDecoration="line-through"
          data-revision-kind="deletion"
          role="group"
          aria-label="Removed content"
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </Box>
      ),
      "revision-inline-addition": ({ children }: { children?: ReactNode }) => (
        <Box
          as="ins"
          bg="highlight.addition.bg"
          data-revision-kind="addition"
          role="group"
          aria-label="Added content"
          textDecoration="none"
        >
          {children}
        </Box>
      ),
      "revision-modification": ({
        children,
        previousStartLine,
        previousEndLine,
      }: {
        children?: ReactNode;
        previousStartLine: number;
        previousEndLine: number;
      }) => (
        <Stack
          className="document-diff-modification"
          gap="3"
          data-previous-source-line={previousStartLine}
          data-previous-source-end-line={previousEndLine}
        >
          {children}
          <DeletedCommentThreads previousStartLine={previousStartLine} />
        </Stack>
      ),
      "revision-addition": ({ children }: { children?: ReactNode }) => (
        <DocumentDiffBlock kind="addition">{children}</DocumentDiffBlock>
      ),
      "revision-deletion": ({
        markdown,
        previousStartLine,
        previousEndLine,
      }: {
        markdown?: string;
        previousStartLine: number;
        previousEndLine: number;
      }) => (
        <DeletedMarkdownBlock
          markdown={markdown ?? ""}
          previousStartLine={previousStartLine}
          previousEndLine={previousEndLine}
          documentPath={documentPath}
          showHtmlComments={showHtmlComments}
          theme={theme}
        />
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
