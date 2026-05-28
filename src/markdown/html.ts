import { type MarkdownBlock, parseMarkdown } from "./parser.ts";

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string =>
  escapeHtml(value).replaceAll("`", "&#96;");

const renderInline = (value: string): string => {
  const codeSpans: string[] = [];
  let html = value.replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  html = escapeHtml(html)
    .replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+(?:"([^"]*)"|&quot;(.+?)&quot;))?\)/g,
      (
        _match,
        alt: string,
        src: string,
        title: string | undefined,
        escapedTitle: string | undefined,
      ) => {
        const titleValue = title ?? escapedTitle;
        const titleAttr = titleValue
          ? ` title="${escapeAttribute(titleValue)}"`
          : "";
        return `<img src="${escapeAttribute(src)}" alt="${
          escapeAttribute(alt)
        }"${titleAttr}>`;
      },
    )
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)(?:\s+(?:"([^"]*)"|&quot;(.+?)&quot;))?\)/g,
      (
        _match,
        label: string,
        href: string,
        title: string | undefined,
        escapedTitle: string | undefined,
      ) => {
        const titleValue = title ?? escapedTitle;
        const titleAttr = titleValue
          ? ` title="${escapeAttribute(titleValue)}"`
          : "";
        return `<a href="${escapeAttribute(href)}"${titleAttr}>${label}</a>`;
      },
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\s][^_]*[^_\s]|[^_\s])_/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  for (const [index, code] of codeSpans.entries()) {
    html = html.replace(`\u0000CODE${index}\u0000`, code);
  }

  return html;
};

type RenderContext = {
  headingSlugs: Map<string, number>;
};

const createRenderContext = (): RenderContext => ({
  headingSlugs: new Map(),
});

const plainHeadingText = (value: string): string =>
  value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "");

const slugifyHeading = (value: string): string => {
  const slug = plainHeadingText(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug || "heading";
};

const headingId = (text: string, context: RenderContext): string => {
  const slug = slugifyHeading(text);
  const count = context.headingSlugs.get(slug) ?? 0;
  context.headingSlugs.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count}`;
};

const cellAttribute = (
  alignment: "left" | "center" | "right" | undefined,
): string => alignment ? ` style="text-align: ${alignment}"` : "";

const renderTable = (
  block: Extract<MarkdownBlock, { type: "table" }>,
): string => {
  const head = block.headers
    .map((header, cellIndex) =>
      `<th${cellAttribute(block.alignments[cellIndex])}>${
        renderInline(header)
      }</th>`
    )
    .join("");
  const body = block.rows
    .map((row) => {
      const cells = block.headers
        .map(
          (_header, cellIndex) =>
            `<td${cellAttribute(block.alignments[cellIndex])}>${
              renderInline(row[cellIndex] ?? "")
            }</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n");

  return `<table>\n<thead>\n<tr>${head}</tr>\n</thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
};

const renderBlock = (block: MarkdownBlock, context: RenderContext): string => {
  switch (block.type) {
    case "heading": {
      const id = headingId(block.text, context);
      return `<h${block.level} id="${
        escapeAttribute(id)
      }"><a class="heading-anchor" href="#${escapeAttribute(id)}">${
        renderInline(block.text)
      }</a></h${block.level}>`;
    }
    case "paragraph":
      return `<p>${renderInline(block.text)}</p>`;
    case "code": {
      const languageClass = block.language
        ? ` class="language-${escapeAttribute(block.language)}"`
        : "";
      return `<pre><code${languageClass}>${
        escapeHtml(block.code)
      }</code></pre>`;
    }
    case "mermaid":
      return `<pre class="mermaid">${escapeHtml(block.code)}</pre>`;
    case "blockquote":
      return `<blockquote>\n${
        renderMarkdownBlocks(block.blocks, context)
      }\n</blockquote>`;
    case "table":
      return renderTable(block);
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items.map((item) => `<li>${renderInline(item)}</li>`)
        .join("\n");
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case "hr":
      return "<hr>";
  }
};

export const renderMarkdownBlocks = (
  blocks: MarkdownBlock[],
  context: RenderContext = createRenderContext(),
): string => blocks.map((block) => renderBlock(block, context)).join("\n\n");

export const renderMarkdown = (markdown: string): string =>
  renderMarkdownBlocks(parseMarkdown(markdown));
