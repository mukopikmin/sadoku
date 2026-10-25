# Legacy CLI output fixtures

`legacy_cli.json` contains 178 sequential command transcripts captured by
running `runCli` from commit `368b47eb1ae18a84d428ce4367d25cb815584968`, the
last TypeScript backend before the Go migration. The reference implementation
was extracted to a temporary directory; it is not needed to run these Go tests.

Each entry records arguments, stdout, stderr, and the exit code. Optional
`files` entries edit the Markdown fixture before a command, exercising comment
rebasing and deleted source lines. The initial `doc.md` contains
`# タイトル\nBody <&>\n`. The commands run against a fresh database with an
isolated configuration directory.

The comparison replaces only temporary directory paths (`$ROOT`) and ISO
millisecond timestamps (`$TIME`). Native Windows separators immediately after
`$ROOT` are normalized to the captured POSIX spelling. `$HELP` expands to the
exact captured help output in `legacy_help.txt`, including its final blank line.
JSON field order, array order, Unicode, escaping, omitted fields, spacing,
newlines, diagnostics, stdout/stderr selection, and exit codes are compared
literally.

Coverage includes every document, tag, instruction, memory, comment and reply
command, help/version output, invalid arguments and missing resources, repeated
options, short options, source edits, resolved/stale comments, and Unicode text.
Startup logs and self-update output have separate tests because they require a
running server or controlled GitHub responses.
