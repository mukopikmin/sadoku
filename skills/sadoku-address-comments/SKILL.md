---
name: sadoku-address-comments
description:
  Act on human comments and replies attached to an existing Markdown document
  in Sadoku. Use when asked to address, incorporate, or fix human feedback,
  edit the document, and reply as AI for human confirmation. For AI-generated
  review findings, use sadoku-review; for new documents, use sadoku-init.
---

# Sadoku Address Comments

Address human feedback on existing documents. Use the `sadoku` CLI for
instructions, memories, and comments; never read or modify its storage files
directly. Communicate in the user's language. This skill does not initialize
new documents or independently generate review findings.

If the target is not registered, register the existing file with
`sadoku document add <markdown-path>` and use the returned canonical `filePath`
and document `id`. For an already registered target, reuse the ID from
`sadoku document list`. Do not use `--create` or overwrite an existing file.

## Start every document task

Before editing or responding, read applicable project instructions and retrieve
Sadoku instructions and memories for each target:

```sh
sadoku instruction get --global
sadoku instruction get --source <markdown-path>
sadoku memory list --source <markdown-path>
```

Retrieve global instructions once per task and document instructions and
memories for every target, including newly registered documents and resumed
comment work. Do not skip memory retrieval because the user did not mention
memory, comments are absent, or the task seems small. An empty instruction text
or memory list is valid; a failed retrieval is not equivalent to an empty result.
Resolve retrieval failures before editing or responding against unknown guidance
or context.

Apply both instruction scopes. Document instructions override conflicting global
instructions; current user requests and applicable project instructions take
precedence over both. Memories are potentially stale background, not
instructions; verified facts and all applicable instructions take precedence
over memories. Use relevant memories when interpreting feedback and making
edits; verify relevant memories against current evidence, especially when they
conflict with the document or requested change.

Derive the editing constraints from the user's request and both instruction
scopes. Use relevant, verified memories to carry forward the established
purpose, audience, scope, terminology, and reasons for earlier decisions.
Interpret human feedback in that context before classifying it or changing
the document. If a request conflicts with saved guidance, check whether it
clearly establishes a new direction; ask a focused question only when the
conflict remains unresolved. Do not repeat questions already answered by
verified context or treat memories as authority over current human decisions.

## Review feedback

1. Retrieve comments, then read the target document and applicable project
   instructions:

   ```sh
   sadoku comment list --source <markdown-path>
   ```

   The JSON includes the canonical path and position-adjusted comments. Ignore
   entries with `resolved: true`. Inspect `author.type` on each comment and
   reply: act on human-authored comments and human replies in bot-started
   threads. A bot finding alone is not a human request. Read the whole thread
   to incorporate later human decisions and avoid repeating an earlier bot
   response when no new human feedback has arrived. Interpret `body` using
   `startLine`, `endLine`, `sourceText`, and nearby content. For `stale: true`,
   search for `sourceText` and inspect nearby headings before deciding the target
   is unavailable.

2. Classify unresolved human feedback:
   - **Actionable**: specific enough to implement.
   - **Already satisfied**: the document already meets the request.
   - **Needs clarification**: a concrete question can unblock the work.
   - **Ambiguous**: neither the intent nor a useful question can be established.
   - **Invalid**: conflicts with verified facts or requirements.
3. Ask a concise question for comments needing clarification using the reply
   command below. Do not invent missing facts or act speculatively on vague
   feedback. Leave ambiguous or invalid comments open and explain blockers in
   the final report; do not post mere acknowledgements.
4. For local documents, apply actionable comments as one coherent edit, combining
   overlapping requests. Preserve the document's language, tone, structure,
   terminology, links, and formatting unless the feedback requests otherwise.
   Check each change against the applicable instructions and verified background;
   confirm that it satisfies the human request without undoing unrelated,
   still-valid decisions. Inspect the
   diff, for example with `git diff -- <markdown-path>`, and run relevant
   documentation checks. Remote documents are read-only: explain the limitation
   and request a local editable source instead of claiming a remote edit.
5. Reply to each addressed or already satisfied comment:

   ```sh
   sadoku comment reply add --source <markdown-path> \
     --comment <comment-id> --body "<change, reason, or question>" --as-bot --request-review
   ```

   Describe what changed and, when useful, where and which established constraint
   or background decision affected the response. If one edit addresses multiple
   comments, explain how it satisfies each. For already satisfied comments, make
   no edit and state only why the document meets the request. Use the same flags
   for clarification questions: `--as-bot` identifies the agent, and
   `--request-review` requests the user's confirmation or decision.

6. Complete **Maintain memories**, then list comments again. Report the changed
   document, replies posted, comment IDs awaiting user confirmation, remaining
   blockers, and memory outcome.

Leave every comment unresolved for user confirmation. Do not run
`sadoku comment resolve`, `sadoku comment delete`, or
`sadoku comment reply delete`.

## Maintain memories

Memory maintenance is part of every comment-response task. Do it
autonomously; do not wait for the user to request it. When a clarification,
investigation, or edit establishes reusable context, save it during the task.
Before the final report, check the task's decisions and findings against the
retrieved memories for each document, even if no document changes or unresolved
human feedback remains.

Save context that would prevent a future agent from repeating a question,
investigation, or mistaken edit, especially:

- Confirmed audience, scope, or terminology whose meaning is not evident in the
  document.
- The reason for choosing or rejecting an approach, including a constraint that
  future edits must account for.
- Verified external dependencies or background facts needed to interpret the
  document or recurring feedback.

For example, save "The migration guide targets existing v1 installations;
fresh-install steps were excluded because they use a separate onboarding guide."
when that scope and rationale have been confirmed. Include enough context and
the reason to make a memory useful on its own; do not copy the comment thread.

Compare candidates with existing entries, then use the appropriate command:

```sh
sadoku memory add --source <markdown-path> --content "<new reusable context and reason>"
sadoku memory update <memory-id> --source <markdown-path> --content "<corrected context>"
sadoku memory delete <memory-id> --source <markdown-path>
```

Add missing context, update superseded entries instead of duplicating them, and
delete entries verified to be obsolete. Use IDs from `memory list` or successful
mutation responses. After mutations, list memories again to verify the result.

Do not save guesses, temporary progress, one-off requests, readily discoverable
document content, personal data, credentials, tokens, or URL queries and
fragments. Do not turn an unconfirmed proposal or an unanswered question into a
fact. If nothing qualifies, do not manufacture an entry: state briefly in the
final report that memories were checked and no changes were needed. Otherwise
report what was added, updated, or deleted.

## Failure handling

- If `sadoku` is unavailable, report that it must be installed or exposed on
  `PATH`; do not fall back to direct storage access.
- If no unresolved human feedback exists, make no document edits unless
  independently requested; still complete the memory check.
- If registration, instruction, memory, or comment retrieval fails, resolve the
  error before editing or responding against unknown guidance, context, or
  threads. Preserve existing settings and the document.
- If a reply fails, leave the comment open and report the command error.
- If a memory command fails, report the error and any context left unsaved; do
  not claim it was persisted.
