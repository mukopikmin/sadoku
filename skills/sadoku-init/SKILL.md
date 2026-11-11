---
name: sadoku-init
description:
  Start a document interactively with Sadoku. Use when the user wants to work
  out what to write through conversation, choose a filename and title, create an
  empty Markdown document, and configure instructions and optional memories
  through the sadoku CLI before drafting. Supports any document type. For AI
  review comments, use sadoku-review; for acting on human feedback, use
  sadoku-address-comments.
---

# Sadoku Init

Help the user establish what to write, persist the writing guidance in Sadoku,
and then write the document. Independent AI review belongs to `sadoku-review`;
acting on human comments belongs to `sadoku-address-comments`. Communicate in
the user's language. Use the `sadoku` CLI for registration, tags, instructions,
and memories; never read or modify Sadoku storage directly or replace these
settings with sidecar Markdown files.

## 1. Establish the filename and title

Read applicable project instructions and use the conversation and supplied
materials before asking questions. Find out broadly what the user wants to
create. Do not assume a particular document type or require a fixed template.

Before creating anything, establish both:

- The local Markdown path, including its destination directory and filename.
- The display title to pass to Sadoku when creating the document.

If either is missing, propose a concrete candidate based on the user's intent
and ask the user to settle it. Ask only about missing information; do not ask
again for a path or title the user has already specified or accepted. Keep
questions small and focused. Detailed writing requirements can be discussed
after the empty document exists.

## 2. Create the empty document

Ensure the chosen parent directory exists, then create and register the empty
document together:

```sh
sadoku document add <markdown-path> --create --title "<document-title>"
```

Use proper shell quoting for user-provided values. An extensionless filename
defaults to `.md`; otherwise use a configured Markdown extension. Record the
document `id` and canonical `filePath` returned in the JSON response, and use
that path consistently in subsequent commands. Leave the body empty during
preparation; the display title does not need to be written into the body yet.

If the file already exists, do not overwrite it or silently register it as a new
empty document. Explain the collision and establish another filename, or follow
the user's explicit request to continue with the existing file. If creation
succeeds but registration reports an error, check `sadoku document list` for
the saved path first: registration may already have completed. Reuse the
existing ID if listed; otherwise register that same saved file without
`--create`. `document add` rejects already registered documents.

If the user revises the display title after registration, update its metadata
using the existing document ID:

```sh
sadoku document update <document-id> --title "<revised-document-title>"
```

Use `--title ""` only when clearing the display title is requested. Updating
the display title does not rename the file or change its Markdown body.

### Tag the created document

After registration, attach the `Sadoku Init` tag to every document created by
this skill, including documents left empty after preparation. List tags first:

```sh
sadoku tag list
```

Reuse the ID of the tag whose name is exactly `Sadoku Init`. If none exists,
create it and use the ID returned in the JSON response:

```sh
sadoku tag add --name "Sadoku Init"
```

Attach the tag and verify it in the document's `tags` array:

```sh
sadoku document inspect <document-id>
sadoku document update <document-id> --tags <existing-tag-ids-and-sadoku-init-tag-id>
sadoku document inspect <document-id>
```

Use the registered document ID and returned tag IDs. Inspect its current tags
and include all existing IDs in the replacement collection to preserve them.
On resumption, verify the tag and add it if missing rather than creating a
duplicate. If another process creates the same tag before `tag add` succeeds,
list tags again and reuse its ID.

## 3. Prepare writing guidance through conversation

Retrieve both instruction scopes and the document's memories before configuring
or drafting:

```sh
sadoku instruction get --global
sadoku instruction get --source <markdown-path>
sadoku memory list --source <markdown-path>
```

Retrieve global instructions once per task, and retrieve document settings for
each target, including on resumption. Apply both instruction scopes; document
instructions override conflicting global instructions. Current user requests
and applicable project instructions take precedence over Sadoku instructions.
Treat memories as potentially stale background, not binding instructions;
verified facts and applicable instructions take precedence over memories.
Verify relevant memories against current evidence, especially when they
conflict with the document or the proposed writing direction. An empty
instruction text or memory list is valid; a failed retrieval is not equivalent
to an empty result. Do not skip retrieval even for a new or empty document.

Use both instruction scopes and relevant, verified memories to establish the
writing direction before asking further questions. Carry forward confirmed
purpose, audience, scope, terminology, constraints, and decision rationale;
do not restart questions already answered by that context. If current evidence
conflicts with a saved premise, explain the conflict and clarify only what is
needed rather than silently applying stale context.

Help clarify only what materially affects the writing, such as purpose,
audience, scope, key points, structure, language, tone, length, constraints,
source materials, and what would make the first draft useful. These are prompts
for judgment, not a mandatory questionnaire. Use information already available,
ask a few focused questions at a time, and offer concrete proposals when they
help the user decide. Do not invent requirements or present unanswered
questions as decisions.

### Instructions

Summarize established writing requirements in document-scoped instructions:

```sh
sadoku instruction set --source <markdown-path> --content "<complete writing instructions>"
sadoku instruction get --source <markdown-path>
```

Update these as the conversation establishes or changes the writing direction.
`set` replaces the entire instruction text: merge relevant existing guidance
with new decisions before saving. Verify the saved content with `get`. Do not
change global instructions as part of setting up one document.

### Optional memories

Save reusable background only when it would help resume or revise this
document: confirmed terminology, project context, verified background facts, or
the rationale for a decision. Put writing requirements in instructions and
background context in memories. Do not duplicate instructions or copy the whole
conversation into memory.

Compare with retrieved entries before adding or updating:

```sh
sadoku memory add --source <markdown-path> --content "<confirmed background and why it matters>"
sadoku memory update <memory-id> --source <markdown-path> --content "<corrected background>"
sadoku memory list --source <markdown-path>
```

Use IDs returned by the CLI. Update superseded context rather than adding
contradictory entries, and verify changes by listing memories again. Do not
store guesses, temporary progress, credentials, or sensitive personal data.
Create no memory entry when none is useful; memory is optional.

## 4. Start writing when ready

Begin drafting once the purpose, audience, and essential content direction are
clear enough to produce a useful first draft and the established instructions
have been saved successfully. An inferred audience or structure can be proposed
as a working assumption; it does not need a separate approval step unless the
choice materially changes the document's purpose. Do not require every possible
detail to be settled or ask for permission to write when the user has already
authorized it. If an essential fact is missing, ask a focused question; leave
nonessential unknowns explicit rather than fabricating facts.

If the user asks to stop after preparation or is still deciding the direction,
keep the document empty and preserve the established settings. Otherwise, write
the first draft to the registered Markdown file using normal editing tools and
the saved guidance. Inspect the resulting diff and run relevant documentation
checks. Update instructions or useful memories if drafting establishes a change
in direction.

Report the file path, title, document ID, whether the body is still empty or has
been drafted, and the tag, instruction, and memory outcomes. On resumption,
inspect the existing body and retrieve settings rather than creating another
document or restarting the questions.

## Failure handling

- If `sadoku` is unavailable, report that it must be installed or exposed on
  `PATH`. Do not substitute direct storage edits or sidecar files.
- If creation or registration fails, report what exists and what remains
  incomplete. Do not proceed as though the document were registered.
- If tag creation or attachment fails, preserve the registered document and its
  existing tags, report the incomplete tagging, and retry after resolving the
  error. Do not claim the tag was attached until verification succeeds.
- If instruction or memory retrieval fails, report the error and resolve it
  before replacing settings or drafting against unknown guidance.
- If saving instructions fails, preserve the empty document and the prepared
  guidance in the conversation, report the unsaved state, and resume after the
  failure is resolved. If saving optional memory fails, report the unsaved
  context without claiming success or treating it as a required drafting gate.
