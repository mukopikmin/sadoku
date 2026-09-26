# GitHub comment export

**Save to GitHub review** explicitly saves an individual human parent comment to
the authenticated user's pending review. Sadoku reads the current GitHub user,
reviews and comments on every operation. It reuses a review started in the
browser, or creates a pending review together with the first comment. No review
ID or export receipt is persisted locally. Submit or discard the review on
GitHub.

| Situation                                                                         | Behavior                                                                                                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Local file, directory, ordinary URL, reply, Bot comment, resolved or stale parent | Export is unavailable.                                                                                                 |
| No pending review                                                                 | Create a pending review with the first comment, pinned to the displayed commit.                                        |
| Existing pending review by the authenticated user                                 | Add to that review, preserving its other comments.                                                                     |
| Other users' reviews or copied markers                                            | Do not modify them or treat their comments as this user's export.                                                      |
| Same parent saved again with unchanged body                                       | Return the pending review link without a mutation.                                                                     |
| Same parent saved again with an edited body                                       | Update its existing pending comment if its revision, path and lines match.                                             |
| GitHub body edited before this explicit save                                      | The local body wins. Only marked Sadoku comments are eligible for updates.                                             |
| GitHub body changes during the save                                               | The final body comparison rejects the update.                                                                          |
| Review already submitted                                                          | Existing exports return their submitted comment link without updating it. A new parent can start a new pending review. |
| Review discarded or exported comment deleted                                      | The next explicit save rediscovers remote state and can create the review/comment again.                               |
| Hidden export marker removed or no longer at the end                              | The old export cannot be detected; another save may create a new comment.                                              |
| PR head changes, including force-push                                             | Refresh the preview before saving.                                                                                     |
| Pending review targets an older commit                                            | Stop; finish or discard that review on GitHub.                                                                         |
| Existing pending comment's revision, path or line range changed                   | Stop; do not move, duplicate or silently rewrite the old anchor.                                                       |
| Displayed Markdown differs anywhere, including whitespace or line endings         | Reject saving.                                                                                                         |
| Closed or merged PR                                                               | Reject new saves. Draft PRs are allowed.                                                                               |
| Single line or multiple lines in one available diff hunk                          | Save on the RIGHT side at the displayed lines.                                                                         |
| Range outside the diff, across hunks, removed file, or absent patch               | Reject; do not change the destination to the conversation or file.                                                     |
| Authentication, permission, network, validation or GraphQL errors                 | Show an error, preserve local comments and do not automatically retry mutations.                                       |
| Simultaneous saves in the same Sadoku PR session                                  | Only one runs at once, including saves of different parents.                                                           |

Saving first validates the displayed head SHA, complete Markdown, parent
creation timestamp, body and line range. The remote Markdown is fetched for this
operation; a saved snapshot cannot authorize a save. The full Markdown is never
included in the GitHub comment. Before a mutation, Sadoku rechecks the PR head
and local parent. Existing pending review state is also checked immediately
before adding or updating.

Duplicate detection hashes the PR URL, relative file path, local parent ID and
creation timestamp, and appends `<!-- sadoku-comment:HASH -->` to the comment
body. Both pending review comments and submitted review comments are searched,
with pagination and author checks. The hash does not change with edits or line
shifts. Replies, automatic bidirectional synchronization, automatic submission,
automatic reanchoring and editing submitted comments are outside this feature.

GitHub remains the source of truth. A restart or a review submitted/discarded in
the browser needs no local cleanup. Review and comment IDs discovered during one
request are used only for that operation. An explicit save overwrites an earlier
GitHub edit to the same marked pending comment; Sadoku does not retain a
previous remote body for three-way merging.

There is no transaction spanning the local checks and GitHub mutations. A push,
review submission, or edit immediately after the final check can still race with
a save. In particular, comment updates have no conditional pending-only
mutation, so a concurrent review submission after the guard can expose that
update. Separate Sadoku processes can also race to create a review or add a
comment. No mutation is automatically retried: inspect GitHub after an uncertain
result, then save again to reconcile using the marker. The next request also
rediscovers a review created by a competing process. Exactly-once publication
across processes is not guaranteed.

API references: [reviews](https://docs.github.com/en/rest/pulls/reviews),
[GraphQL review and thread operations](https://docs.github.com/en/graphql/reference/pulls).
