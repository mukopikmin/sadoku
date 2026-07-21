---
name: sadoku-review
description: Read unresolved Sadoku review comments through the sadoku CLI, apply requested changes to the referenced Markdown document, verify the result, and reply with focused Markdown diffs while leaving comments open for user confirmation. Use when asked to review, address, incorporate, or fix feedback attached to a Markdown file with Sadoku.
---

# Sadoku Review

Use the `sadoku` CLI to access review comments. Do not read or modify Sadoku's
comment storage files directly.

When communicating with the user, use the user's language for replies,
questions, and the final report.

## Workflow

1. Identify the target Markdown document.
2. Inspect its unresolved comments:

   ```sh
   sadoku comments inspect <markdown-path>
   ```

   The command returns JSON containing the canonical Markdown path and
   position-adjusted unresolved comments.
3. Read the target document and applicable project instructions. For each
   comment, interpret `body` as the request and use `line`, `sourceText`, and
   nearby document content to identify its subject.
4. Classify each comment:
   - **Actionable**: specific enough to implement.
   - **Already satisfied**: the document already meets the request.
   - **Needs clarification**: a concrete question can unblock the work.
   - **Ambiguous**: the intent or target cannot be established safely and no
     useful question can be formed.
   - **Invalid**: the request conflicts with verified facts or requirements.
5. Reply to comments that need clarification and leave them unresolved:

   ```sh
   sadoku comments reply <markdown-path> <comment-id> "<question>" --as-bot
   ```

   Keep the question concise and state the missing decision or information.
6. Apply actionable comments as one coherent edit. Preserve the document's
   language, tone, structure, terminology, links, and formatting unless the
   feedback requests otherwise.
7. Review the resulting diff and run relevant documentation checks available in
   the project.
8. Reply to each addressed comment and leave it unresolved for the user to
   confirm:

   ```sh
   sadoku comments reply <markdown-path> <comment-id> "<body>" --as-bot
   ```

   Each reply must include at least:
   - A brief summary of what changed.
   - A focused excerpt of the Markdown diff relevant to that comment, enclosed
     in a fenced code block whose info string is `diff`.
   - When one edit addresses multiple comments, an explanation of which change
     satisfies each comment.

   Format a changed-comment reply like this:

   ````markdown
   Changed the heading and clarified the opening sentence.

   ```diff
   -# Old heading
   +# New heading
   ```
   ````

   Inspect the diff with a command such as `git diff -- <markdown-path>`.
   Include only the necessary range in the reply; do not paste large unrelated
   portions of the diff. For comments classified as **Already satisfied**, reply
   with the reason the document already satisfies the request; a diff block is
   not required when no change was made.
9. Do not run `sadoku comments resolve`. The user must review the reply and the
   document change, then decide whether to resolve the comment.
10. Run `sadoku comments inspect <markdown-path>` again. In the console or final
    user-facing report, include a concise summary of the review outcome: the
    changed document, replies posted, comment IDs awaiting user confirmation,
    and comments left open for clarification or other reasons.

## Interpretation Rules

- Ignore comments with `resolved: true`; `inspect` normally omits them.
- Treat `stale: true` as a position warning. Search for `sourceText` and inspect
  nearby headings and paragraphs before deciding the target is unavailable.
- Do not invent substantive facts missing from the document or its project.
  Leave those comments open and explain what information is required.
- Combine overlapping comments into one consistent edit.
- Do not act on vague or nonsensical feedback speculatively.
- Do not reply merely to acknowledge a comment. Reply only when the response
  communicates useful information or asks a question needed to continue.
- Add `--as-bot` to every comment reply posted by the agent so that Sadoku
  attributes the operation to a bot.
- Leave all comments unresolved, including comments that were successfully
  addressed or already satisfied, until the user confirms them.
- Do not use `sadoku comments rm`; it deletes every stored comment for the
  specified Markdown document.

## Failure Handling

- If `sadoku` is unavailable, report that the CLI must be installed or exposed
  on `PATH`. Do not fall back to direct comment-storage access.
- If `inspect` reports no comments, make no document changes unless the user
  requested additional edits independently.
- If replying to a comment fails, leave it open and report the command error.
