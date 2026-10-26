def stable_tag:
  type == "string" and test("^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$");
def baseline: "release-notes-baseline";
def newer($version; $previous):
  $previous == baseline or
  (($version | split(".") | map([length, .])) >
   ($previous | ltrimstr("v") | split(".") | map([length, .])));
def check($name; $ok; $actual; $expected):
  {name: $name, ok: $ok, actual: $actual, expected: $expected};

$ARGS.named as $args |
$args.mode as $mode |
$args.version as $version |
$args.head as $head |
$args.repository as $repository |
$args.approved as $approved |
$args.tags as $tags |
$args.releases as $releases |
$args.context as $context |
$args.main as $main |
$args.tag_object as $tag_object |
$args.tag_commit as $tag_commit |
$args.remote as $remote |
$args.previous as $previous |
$args.ancestor as $ancestor |
$args.root_ok as $root_ok |
$args.ci as $ci |
$args.notes as $notes |

if $mode == "context" then
  if ($releases | all(.[];
    (.tagName | type == "string") and (.isDraft | type == "boolean") and
    (.isPrerelease | type == "boolean"))) then .
  else error("Invalid GitHub release metadata") end |
  ($releases | map(select(.isDraft == false and .isPrerelease == false and
    (.tagName | stable_tag))) | .[0].tagName // baseline) as $previous |
  {headSha: $head, repository: $repository, releases: $releases,
   previousStableTag: $previous, approvedPreviousStableTag: $approved,
   stableTags: []} |
  # Match complete refs, excluding peeled annotated tags and the release being checked.
  .stableTags = [$tags | split("\n")[] |
    capture("^[^\\s]+\\s+refs/tags/(?<tag>v[^\\s]+)$") | .tag |
    select(stable_tag and . != ("v" + $version))] |
  .baselineSelection = (if $previous == baseline then "no stable release returned by GitHub"
                        else "first stable release in GitHub API order" end) |
  if $previous == baseline and (.stableTags | length) > 0 then
    error("Cannot infer a first release: stable tags exist but no stable releases were returned: " + tojson)
  elif $previous != $approved then
    error("Notes baseline differs from the approved tag trailer: " + tojson)
  else . end
elif $mode == "check" then
  if ($ci | type) != "array" then error("Invalid Test run metadata") else . end |
  ("v" + $version) as $tag |
  ("refs/tags/" + $tag) as $ref |
  ([$remote | split("\n")[] | capture("^(?<object>[^\\s]+)\\s+(?<ref>[^\\s]+)$") |
    select(.ref == $ref) | .object][0] // "") as $remote_object |
  ([$ci[] | select((.databaseId | type) == "number" and .databaseId > 0 and
    .workflowName == "Test" and .headBranch == "main" and .event == "push" and
    .status == "completed" and .conclusion == "success" and .headSha == $context.headSha and
    (.url | type) == "string" and (.url | length) > 0)][0]) as $successful |
  ($context.releases | all(.[]; .tagName != $tag)) as $absent |
  $context + {version: $version, tag: $tag, tagObject: $tag_object, ciRuns: $ci,
    checks: [
      check("remoteMain"; $context.headSha == $main; $context.headSha; $main),
      check("releaseTag"; $tag_commit == $context.headSha and $remote_object == $tag_object;
        "\($tag_commit) / \($tag_object) locally / \($remote_object) on origin";
        "unchanged \($tag) at \($context.headSha)"),
      check("releaseAbsent"; $absent; if $absent then "absent" else "already exists" end;
        "absent, including drafts"),
      check("notesBaseline"; $ancestor and $previous != $context.headSha and $root_ok;
        "\($context.previousStableTag) at \($previous)";
        "an earlier ancestor; the root commit for the first release"),
      check("newerVersion"; newer($version; $context.previousStableTag); $version;
        "newer than \($context.previousStableTag)"),
      check("ci"; $successful != null;
        "selected URL: \($successful.url // ""); returned runs: \($ci | tojson)";
        "successful Test run for \($context.headSha)")
    ]} | .ok = all(.checks[]; .ok)
elif $mode == "notes" then
  if ($notes.body | type) != "string" or ($notes.body | test("^\\s*$")) then
    error("Generated release notes are empty")
  else {version: $version, tag: ("v" + $version), headSha: $context.headSha,
    previousStableTag: $context.previousStableTag,
    title: (if ($notes.name | type) == "string" and $notes.name != "" then $notes.name
            else "v" + $version end), body: $notes.body} end
else error("Unknown release filter mode") end
