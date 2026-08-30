---
name: sadoku-review
description: Read unresolved Sadoku review comments through the sadoku CLI, apply requested changes to the referenced Markdown document, verify the result, and reply with a concise description of the changes while leaving comments open for user confirmation. Use when asked to review, address, incorporate, or fix feedback attached to a Markdown file with Sadoku.
---

# Sadoku Review

Use the `sadoku` CLI to access review comments. Do not read or modify Sadoku's
comment storage files directly.

When communicating with the user, use the user's language for replies,
questions, and the final report.

## Workflow

1. Identify the target Markdown document.
2. List its document instructions, then list its comments:

   ```sh
   sadoku instruction list --source <markdown-path>
   ```

   Apply every instruction returned by the command throughout the review. Then
   retrieve the comments:

   ```sh
   sadoku comment list --source <markdown-path>
   ```

   The command returns JSON containing the canonical Markdown path and
   position-adjusted comments. Ignore entries with `resolved: true`.
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
   sadoku comment reply add --source <markdown-path> \
     --comment <comment-id> --body "<question>" --as-bot --request-review
   ```

   Keep the question concise and state the missing decision or information. Use
   `--request-review` because the reply requires the user to review it and make
   a decision before the comment can be addressed.
6. Apply actionable comments as one coherent edit. Preserve the document's
   language, tone, structure, terminology, links, and formatting unless the
   feedback requests otherwise.
7. Review the resulting diff and run relevant documentation checks available in
   the project.
8. Reply to each addressed comment and leave it unresolved for the user to
   confirm:

   ```sh
   sadoku comment reply add --source <markdown-path> \
     --comment <comment-id> --body "<body>" --as-bot --request-review
   ```

   Each reply must include at least:
   - A concise sentence or bullet list explaining what changed.
   - When useful, the affected heading, paragraph, or other location.
   - When one edit addresses multiple comments, an explanation of which change
     satisfies each comment.

   Format a changed-comment reply like this:

   > Changed the heading from "Old heading" to "New heading" and clarified the
   > opening sentence in that section.

   Internally inspect the change with a command such as
   `git diff -- <markdown-path>`. For **Already satisfied** comments, make no
   change and reply concisely with only the reason the document already
   satisfies the request. Use `--request-review` for these replies because the
   user must confirm that the change addresses the comment or that the existing
   document is satisfactory.
9. Do not run `sadoku comment resolve`. The user must review the reply and the
   document change, then decide whether to resolve the comment.
10. Run `sadoku comment list --source <markdown-path>` again. In the console or
    final user-facing report, include a concise summary of the review outcome:
    the changed document, replies posted, comment IDs flagged for review while
    awaiting user confirmation, and comments left open for clarification or
    other reasons.

## Interpretation Rules

- Ignore comments with `resolved: true`.
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
- Add `--request-review` to a reply whenever its content requires the user's
  confirmation or decision. Do not add a review flag to **Ambiguous** or
  **Invalid** comments that receive no reply and are simply left unresolved.
- Leave all comments unresolved, including comments that were successfully
  addressed or already satisfied, until the user confirms them.
- Do not use `sadoku comment delete` or `sadoku comment reply delete` during the
  review workflow. Leave review records intact for user confirmation.

## Failure Handling

- If `sadoku` is unavailable, report that the CLI must be installed or exposed
  on `PATH`. Do not fall back to direct comment-storage access.
- If `comment list` reports no unresolved comments, make no document changes
  unless the user requested additional edits independently.
- If replying to a comment fails, leave it open and report the command error.
