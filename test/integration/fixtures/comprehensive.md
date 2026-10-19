# Comprehensive Document

Intro paragraph with **bold**, _italic_, ~~deleted~~, `inline code`,
[an inline link](https://example.com "Example title"), a reference link to
[the docs][docs], and an inline image ![status badge](image.png "Image title").

Second paragraph after inline media to verify paragraph spacing between rich
inline content and the next block.

## Headings And Paragraph Flow

Text before a subheading.

### Subheading Between Paragraphs

Text after a subheading with a plain URL: https://example.com/path?q=1.

#### Deep Heading

Paragraph after a deep heading with escaped punctuation: \*not emphasized\* and
an entity: &copy;.

## Mixed Lists

Text before an unordered list.

- unordered one
- unordered two
  - nested unordered after inline text
  - nested unordered before an ordered list
    1. nested ordered one
    2. nested ordered two
       - deeply nested unordered after ordered text
- unordered three after the nested list

Text between unordered and ordered lists.

1. ordered one
2. ordered two
   1. nested ordered child
   2. nested ordered child with a task list below
      - [ ] nested unchecked task
      - [x] nested checked task
3. ordered three after nested tasks

Text between ordered and task lists.

- [ ] unchecked task
- [x] checked task
- [x] uppercase checked task

Text after task lists.

## Simple Nested Lists

- Parent item before a nested list
  - Nested list first item
  - Nested list second item
- Second parent item after a nested list

Paragraph after simple nested lists.

## Blockquotes Around Other Blocks

Paragraph before a blockquote.

> Quoted **text** with a hard line break.\
> The second quoted line stays in the same quote.
>
> - quoted unordered item
> - quoted unordered item with nested ordered items
>   1. quoted ordered child
>   2. quoted ordered child
>
> Quote paragraph after a list.

Paragraph between blockquote and horizontal rule.

---

Paragraph after the horizontal rule.

## Tables Between Text

Paragraph before a table.

| Feature | Status | Owner |
| ------- | :----: | ----: |
| Table   |  yes   |     1 |
| Mermaid |  yes   |     2 |
| Lists   |  yes   |     3 |

Paragraph after a table before code.

## Code Blocks

Indented code follows this paragraph.

    const indented = "<escaped>";
    console.log(indented);

Paragraph between indented code and fenced code.

```js
console.log("<escaped>");
```

Paragraph between fenced code blocks.

```ts
type PreviewState = "loading" | "ready";
const state: PreviewState = "ready";
```

Paragraph before a diff code block.

```diff
-const status = "loading";
+const status = "ready";
```

## Mermaid Diagrams

### Flowchart

Paragraph before a Mermaid flowchart.

```mermaid
graph TD
  CLI[CLI] --> Server[Server]
  Server --> Browser[Browser]
```

### Class Diagram

Paragraph before a Mermaid class diagram.

```mermaid
classDiagram
  class PreviewSource {
    <<interface>>
    +read() String
  }
  class MarkdownFile {
    +String path
    +read() String
  }
  class PreviewServer {
    +start() void
    +reload() void
  }
  PreviewSource <|.. MarkdownFile : implements
  PreviewServer --> PreviewSource : reads
```

### Sequence Diagram

```mermaid
sequenceDiagram
  actor User
  participant Browser
  participant Server
  User->>Browser: Open Markdown preview
  Browser->>Server: Request document
  activate Server
  Server-->>Browser: Markdown content
  deactivate Server
  alt Document changes
    Server-->>Browser: Reload event
    Browser->>Server: Request updated document
  else Document unchanged
    Note over Browser,Server: Keep the preview open
  end
```

### State Diagram

```mermaid
stateDiagram-v2
  [*] --> Loading
  Loading --> Ready: Document loaded
  Loading --> Error: Read failed
  Ready --> Loading: File changed
  Error --> Loading: Retry
  Ready --> [*]: Close preview
```

### Entity Relationship Diagram

```mermaid
erDiagram
  DOCUMENT ||--o{ COMMENT : contains
  COMMENT ||--o{ REPLY : has
  DOCUMENT {
    int id PK
    string path
    string title
  }
  COMMENT {
    int id PK
    int document_id FK
    int start_line
    string body
  }
  REPLY {
    int id PK
    int comment_id FK
    string body
  }
```

### Gantt Chart

```mermaid
gantt
  title Preview release plan
  dateFormat YYYY-MM-DD
  axisFormat %m/%d
  section Implementation
    Markdown rendering :done, markdown, 2026-10-01, 3d
    Mermaid diagrams :active, diagrams, after markdown, 4d
  section Validation
    Browser checks :checks, after diagrams, 2d
    Release :milestone, after checks, 0d
```

### Pie Chart

```mermaid
pie showData
  title Review comments by status
  "Open" : 8
  "Resolved" : 15
  "Needs follow-up" : 4
```

### User Journey

```mermaid
journey
  title Review a Markdown document
  section Open
    Start preview: 5: Author
    Read document: 4: Reviewer
  section Review
    Add comment: 4: Reviewer
    Reply to comment: 4: Author
    Resolve thread: 5: Author, Reviewer
```

### Mindmap

```mermaid
mindmap
  root((Markdown preview))
    Content
      Headings
      Tables
      Code blocks
    Diagrams
      Flowcharts
      Class diagrams
      Sequence diagrams
    Review
      Comments
      Replies
```

### Timeline

```mermaid
timeline
  title Preview feature milestones
  section Rendering
    First release : Markdown preview
    Diagrams : Local Mermaid assets
             : Diagram zoom
  section Collaboration
    Review : Inline comments
           : Thread replies
```

### Git Graph

```mermaid
gitGraph
  commit id: "Initial preview"
  branch diagrams
  checkout diagrams
  commit id: "Add Mermaid"
  commit id: "Add diagram samples"
  checkout main
  commit id: "Update docs"
  merge diagrams id: "Merge diagrams"
```

### Nested Mermaid Fence

Paragraph before a nested fence that should remain code.

````md
```mermaid
graph TD
  A --> B
```
````

Paragraph after nested fences.

## Raw HTML And Unsupported Syntax Samples

Raw HTML should be escaped:

<script>alert("nope")</script>

Definition-list-looking text should remain plain paragraphs:

Term : Definition text

Footnote-looking text should remain plain text.[^note]

[^note]: Footnote definitions are not enabled.

Math-looking text should remain plain text: $a^2 + b^2 = c^2$.

## HTML Comments

Paragraph before an HTML comment.

<!-- This HTML comment should appear in the preview when comments are shown. -->

Paragraph between HTML comments.

<!-- This multiline HTML comment
preserves its source text and line range
when it appears in the preview. -->

Paragraph after HTML comments.

## Final Mixed Sequence

Paragraph before final list.

- final unordered item before quote
- final unordered item after quote text

Paragraph between final list and final rule.

---

Final paragraph after final horizontal rule.

[docs]: https://example.com/docs "Docs title"
