---
name: sadoku-review
description:
  Review an existing Markdown document and post AI-authored findings as Sadoku
  comments using global and document instructions and relevant document memories.
  Use when asked for an AI review or to identify problems and leave
  comments without editing the document. For acting on human feedback, use
  sadoku-address-comments; for new documents, use sadoku-init.
---

# Sadoku Review

Read the document, identify concrete issues, and post review comments through
Sadoku. Communicate in the user's language. Use the `sadoku` CLI for document
registration, instructions, memories, and comments; never read or modify its
storage files directly. Leave the document body unchanged during review.

## 1. Load the document and guidance

Read applicable project instructions and establish the existing target from the
user's request. Use `sadoku document list` to find an already registered target
and its canonical `filePath` and `id`. If needed, register an existing file or URL:

```sh
sadoku document add <markdown-path-or-url>
```

Do not use `--create`; new-document preparation belongs to `sadoku-init`.
Retrieve global instructions once per task and document instructions, memories,
and comments for every target, including on resumption:

```sh
sadoku instruction get --global
sadoku instruction get --source <markdown-path-or-url>
sadoku memory list --source <markdown-path-or-url>
sadoku comment list --source <markdown-path-or-url>
```

Apply both instruction scopes; document instructions override conflicting global
instructions. Current user requests and applicable project instructions take
precedence over Sadoku instructions. Treat memories as potentially stale
background, not binding instructions; verified facts and applicable instructions
take precedence over memories. Verify relevant memories against current evidence,
especially when they conflict with the document or a proposed finding. Do not
skip retrieval because the user did not mention instructions or memories, or
because the review seems small. An empty instruction text or memory list is
valid; a failed retrieval is not equivalent to an empty result.

Read the complete current document and relevant supplied sources. Use the same
source content and line numbering that Sadoku reviews. For a remote target,
retrieve its current Markdown using available source tools; if the exact content
cannot be obtained, report the blocker rather than guessing line numbers.

## 2. Identify findings

Before identifying findings, derive the review criteria from the user's request
and both instruction scopes. Carry forward the established purpose, audience,
scope, terminology, constraints, and explicit review priorities. Use relevant,
verified memories to understand background and the reasons for earlier decisions.
Do not require a fixed document template or apply generic preferences that
conflict with the established direction.

For example, if instructions limit a migration guide to existing installations
and a verified memory explains that fresh installations have a separate guide,
do not flag missing fresh-install steps as an omission. If current evidence
undermines that premise, explain the conflict and ask a focused question rather
than silently treating the memory as authoritative.

Review against these criteria. Look for factual errors,
contradictions, missing essential explanations, unclear requirements, and other
issues that materially affect the intended reader. Verify claims against
available evidence; do not invent facts or manufacture findings to meet a quota.
Before posting each finding, check that it accounts for applicable instructions
and relevant memories. Avoid reopening a deliberate, still-valid decision as a
new issue without evidence. When a finding depends on saved guidance or context,
include enough of that rationale to make the comment understandable on its own.

For each finding, identify the smallest useful current line range, describe the
specific issue and its impact, and suggest a concrete improvement or ask a
focused question. Keep independent findings separate and combine overlapping
ones. Preserve the document's language in comments unless requested otherwise.

Read existing threads before posting. Avoid duplicating an unresolved finding
or repeating a resolved finding unless current evidence shows it still applies;
explain that evidence when raising it again. Human requests to change the
text belong to `sadoku-address-comments` and do not authorize edits in this
review-only task.

## 3. Post AI comments

Post each actionable finding at its verified line range:

```sh
sadoku comment add --source <markdown-path-or-url> \
  --start-line <start-line> --end-line <end-line> \
  --body "<issue, impact, and suggested improvement or question>" --as-bot
```

`--end-line` can be omitted for a single-line finding. Always pass `--as-bot`.
`--request-review` is supported on replies, not on new comments. Use IDs returned
by the CLI; do not edit, resolve, or delete existing comments or replies.

List comments again to verify that each new finding was saved with bot
authorship at the intended location. On resumption or a partial failure, check
what was saved before retrying so comments are not duplicated. Leave comments
open for human consideration. If no concrete issue is found, post nothing.

Report the reviewed target, the main review criteria and relevant background
applied, findings and posted comment IDs, and any limits on what was verified.
Summarize context only when relevant; do not copy the full instructions or memory
list into the report. Do not claim the review is complete if a target,
instruction scope, or document memories could not be read.

## Failure handling

- If `sadoku` is unavailable, report that it must be installed or exposed on
  `PATH`; do not substitute direct storage access or sidecar files.
- Resolve registration, instruction, memory, or comment retrieval failures before
  reviewing or posting findings against unknown guidance, context, or threads.
  Preserve existing guidance and memories.
- If the document changes before comments are posted, re-read the content and
  verify the findings and line ranges first.
- If posting or verification fails, report which comments were confirmed saved
  and which remain incomplete. Do not claim an unsuccessful post was saved.
