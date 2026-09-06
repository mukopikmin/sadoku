import { useMemo } from "react";
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
};

export const CommentableMarkdown = ({
  children,
  showHtmlComments,
}: CommentableMarkdownProps) => {
  const components = useMemo<Components>(() => {
    const markdownComponents = createCommentableMarkdownComponents();
    if (!showHtmlComments) {
      markdownComponents["html-comment"] = () => null;
    }
    return markdownComponents;
  }, [showHtmlComments]);

  return (
    <ReactMarkdown
      components={components}
      rehypePlugins={[
        rehypeSlug,
        [rehypeAutolinkHeadings, {
          behavior: "wrap",
          properties: { className: "heading-anchor" },
          test: (heading) =>
            !heading.children.some((child) =>
              child.type === "element" && child.tagName === "a"
            ),
        }],
        ...sharedMarkdownRehypePlugins,
      ]}
      remarkPlugins={sharedMarkdownRemarkPlugins}
    >
      {children}
    </ReactMarkdown>
  );
};
